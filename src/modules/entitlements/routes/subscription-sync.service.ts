// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { isForeignKeyViolationError } from '@/datasources/errors/helpers/is-foreign-key-violation-error.helper';
import { fromSecondsTimestamp } from '@/domain/common/utils/time';
import { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  isPaymentLinkEventType,
  isSubscriptionEventType,
  WALLET_WEB_CUSTOMER_GROUP,
  type WebhookEvent,
} from '@/modules/billing/domain/entities/webhook-event.entity';
import type { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import {
  mapEventToSubscription,
  mapUpstreamSubscriptions,
} from '@/modules/entitlements/domain/subscription.mapper';
import type { ISubscriptionSyncService } from '@/modules/entitlements/domain/subscription-sync.service.interface';
import { ISubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository.interface';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';

/**
 * Materializes upstream subscription state on billing webhooks.
 *
 * The payload is validated once, at the controller boundary
 * (`ValidationPipe(WebhookEventSchema)` on `BillingController.postWebhook`);
 * this service only ever sees an already-well-formed `WebhookEvent`.
 *
 * An event carrying a complete subscription snapshot (id, plan, status and
 * period start) is offered to `EntitlementsService.materializeFromEvent`,
 * which applies it only while it orders strictly after the mark stored for the
 * space — so a `subscription.updated` delivered after a
 * `subscription.deleted` cannot resurrect the subscription. That decision is
 * taken inside the transaction holding the space's lock, and this service only
 * reacts to its answer.
 *
 * Anything the payload cannot settle — a partial snapshot, no `created` stamp,
 * an event that does not order after what is stored, or a concurrent delivery
 * that moved the mark mid-write — falls back to the authoritative state read
 * from the billing service, so a thin or stale payload never overwrites what
 * is stored.
 *
 * Unprocessable-but-authenticated events (unknown space, `api` customer
 * group) are logged and acked: retrying cannot fix them. Fetch/DB errors
 * propagate as 5xx so the billing service's retry mechanism provides
 * durability.
 */
@Injectable()
export class SubscriptionSyncService implements ISubscriptionSyncService {
  public constructor(
    @Inject(IBillingApi)
    private readonly billingApi: IBillingApi,
    @Inject(EntitlementsService)
    private readonly entitlementsService: EntitlementsService,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IFeaturesRepository)
    private readonly featuresRepository: IFeaturesRepository,
    @Inject(ISubscriptionsRepository)
    private readonly subscriptionsRepository: ISubscriptionsRepository,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async handleWebhook(event: WebhookEvent): Promise<void> {
    if (isPaymentLinkEventType(event.type)) {
      await this.cacheService.deleteByKey(
        CacheRouter.getBillingPaymentLinksCacheDir().key,
      );
      return;
    }
    if (!isSubscriptionEventType(event.type)) {
      this.loggingService.debug(
        `Ignoring billing webhook event type ${event.type} (event ${event.id}): it is not about a subscription`,
      );
      return;
    }

    const space = await this.resolveSpace(event);
    if (space === null) {
      return;
    }

    try {
      await this.syncSubscriptions({ event, ...space });
    } catch (error) {
      // Deleted between resolving the space and writing: retrying cannot fix it.
      if (
        error instanceof NotFoundException ||
        this.isSpaceDeletionRace(error)
      ) {
        this.loggingService.warn(
          `Billing webhook event ${event.id} raced a deletion of space ${space.upstreamCustomerId}`,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * The space the event's customer maps to, or `null` when nothing can be
   * processed.
   */
  private async resolveSpace(event: WebhookEvent): Promise<{
    spaceId: Space['id'];
    upstreamCustomerId: string;
  } | null> {
    // Allow-listed rather than excluding known groups: an unrecognised group
    // added upstream must not silently start writing entitlements.
    const customer = event.data?.customer;
    if (customer?.customerGroup !== WALLET_WEB_CUSTOMER_GROUP) {
      this.loggingService.debug(
        `Ignoring billing webhook for customer group ${customer?.customerGroup} (event ${event.id})`,
      );
      return null;
    }
    const upstreamCustomerIdResult = UuidSchema.safeParse(
      customer.upstreamCustomerId,
    );
    if (!upstreamCustomerIdResult.success) {
      this.loggingService.warn(
        `Billing webhook event ${event.id} (${event.type}) has no valid upstreamCustomerId`,
      );
      return null;
    }
    const upstreamCustomerId = upstreamCustomerIdResult.data;

    try {
      return {
        spaceId: await this.spacesRepository.findIdByUuid(upstreamCustomerId),
        upstreamCustomerId,
      };
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
      this.loggingService.warn(
        `Billing webhook event ${event.id} references unknown space ${upstreamCustomerId}`,
      );
      return null;
    }
  }

  /**
   * Brings the space's stored state in line with the event: from the event's
   * own payload while that settles it, from the authoritative state otherwise.
   */
  private async syncSubscriptions(args: {
    event: WebhookEvent;
    spaceId: Space['id'];
    upstreamCustomerId: string;
  }): Promise<void> {
    const eventAt = fromSecondsTimestamp(args.event.created);
    const features = await this.featuresRepository.getFeatures();
    const featureTypeByKey = new Map(
      features.map((feature) => [feature.key, feature.type]),
    );
    const eventSubscription = mapEventToSubscription({
      event: args.event,
      featureTypeByKey,
      onWarning: (message) => this.loggingService.warn(message),
    });

    if (eventSubscription !== null && eventAt !== null) {
      // The billing-api datasource caches subscriptions in Redis — bust it so
      // the REST read path serves post-event state.
      await this.clearSubscriptionsCache(args.upstreamCustomerId);
      const materialized = await this.entitlementsService.materializeFromEvent({
        spaceId: args.spaceId,
        subscription: eventSubscription,
        eventAt,
      });
      if (materialized) {
        this.loggingService.info(
          `Materialized space ${args.spaceId} from the event payload (event ${args.event.id}, ${args.event.type})`,
        );
        return;
      }
    }

    // Either the payload was not usable — a partial snapshot, no `created`
    // stamp, or an event that does not order after what is stored — or a
    // concurrent delivery moved the mark while it was being written. Upstream
    // decides in every one of those cases.
    const authoritative = await this.readAuthoritativeState({
      spaceId: args.spaceId,
      upstreamCustomerId: args.upstreamCustomerId,
      featureTypeByKey,
    });
    // The billing service proxies Stripe, so a customer that ever had a
    // subscription always lists one. An empty list is therefore an anomaly, not
    // a state to materialize — writing it would retire the space's subscription
    // on nothing more than upstream having a bad day.
    if (authoritative.subscriptions.length === 0) {
      this.loggingService.error(
        `Billing webhook event ${args.event.id} found no subscriptions upstream for space ${args.spaceId}; nothing materialized`,
      );
      return;
    }
    const materialized =
      await this.entitlementsService.materializeAuthoritative({
        spaceId: args.spaceId,
        subscriptions: authoritative.subscriptions,
        observedEventAt: authoritative.observedEventAt,
        triggerEventAt: eventAt,
      });
    if (!materialized) {
      // A concurrent delivery beat the re-fetch too: its state is newer than
      // anything this event could write, so letting it stand is the end.
      this.loggingService.warn(
        `Billing webhook event ${args.event.id} was superseded twice for space ${args.spaceId}; the concurrent delivery's state stands`,
      );
      return;
    }
    this.loggingService.info(
      `Materialized space ${args.spaceId} from the authoritative state (event ${args.event.id}, ${args.event.type})`,
    );
  }

  /**
   * Reads the space's whole subscription state from the billing service. The
   * mark is read before the fetch goes out, so the write it feeds can be
   * abandoned if the space moves on meanwhile, and the Redis cache is busted
   * first, so a second attempt cannot be served the first one's snapshot.
   */
  private async readAuthoritativeState(args: {
    spaceId: Space['id'];
    upstreamCustomerId: string;
    featureTypeByKey: Map<string, FeatureType>;
  }): Promise<{
    observedEventAt: Date | null;
    subscriptions: Array<MaterializedSubscription>;
  }> {
    const observedEventAt = await this.subscriptionsRepository.getLastEventAt(
      args.spaceId,
    );
    await this.clearSubscriptionsCache(args.upstreamCustomerId);
    const subscriptions = mapUpstreamSubscriptions({
      subscriptions: await this.billingApi.getSubscriptionsByCustomerId({
        upstreamCustomerId: args.upstreamCustomerId,
        status: 'all',
      }),
      featureTypeByKey: args.featureTypeByKey,
      onWarning: (message) => this.loggingService.warn(message),
    });
    return { observedEventAt, subscriptions };
  }

  private async clearSubscriptionsCache(
    upstreamCustomerId: string,
  ): Promise<void> {
    await this.cacheService.deleteByKey(
      CacheRouter.getBillingSubscriptionsCacheDir({
        upstreamCustomerId,
        status: 'all',
      }).key,
    );
  }

  /**
   * True for the FK violation the subscriptions insert raises when the space is
   * deleted between the existence check and the insert — narrower than, and not
   * covered by, the NotFoundException that check throws itself.
   */
  private isSpaceDeletionRace(error: unknown): boolean {
    return (
      isForeignKeyViolationError(error) &&
      error.driverError.constraint === 'FK_subscriptions_space_id'
    );
  }
}
