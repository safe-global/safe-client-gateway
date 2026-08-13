// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { isForeignKeyViolationError } from '@/datasources/errors/helpers/is-foreign-key-violation-error.helper';
import { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  isIgnoredEventType,
  isPaymentLinkEventType,
  isSubscriptionEventType,
  WALLET_WEB_CUSTOMER_GROUP,
  type WebhookEvent,
} from '@/modules/billing/domain/entities/webhook-event.entity';
import { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import {
  mapEventToSubscription,
  mapUpstreamSubscriptions,
} from '@/modules/entitlements/domain/subscription.mapper';
import type { ISubscriptionSyncService } from '@/modules/entitlements/domain/subscription-sync.service.interface';
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
 * period start) is materialized directly from the payload. Event types that
 * carry only a partial snapshot fall back to re-fetching the authoritative
 * state from the billing service, so a thin payload never overwrites stored
 * state with nulls.
 *
 * Events are applied in delivery order, without comparing their `created`
 * stamp against what is stored: a late-delivered stale event therefore
 * overwrites a newer one until it is corrected by the next event.
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
    if (isIgnoredEventType(event.type)) {
      this.loggingService.info(
        `Ignoring billing webhook event type ${event.type} (event ${event.id}): it carries no subscription snapshot`,
      );
      return;
    }
    if (!isSubscriptionEventType(event.type)) {
      this.loggingService.info(
        `Ignoring unknown billing webhook event type: ${event.type}`,
      );
      return;
    }

    // Allow-listed rather than excluding known groups: an unrecognised group
    // added upstream must not silently start writing entitlements.
    const customer = event.data?.customer;
    if (customer?.customerGroup !== WALLET_WEB_CUSTOMER_GROUP) {
      this.loggingService.info(
        `Ignoring billing webhook for customer group ${customer?.customerGroup} (event ${event.id})`,
      );
      return;
    }
    const upstreamCustomerIdResult = UuidSchema.safeParse(
      customer?.upstreamCustomerId,
    );
    if (!upstreamCustomerIdResult.success) {
      this.loggingService.warn(
        `Billing webhook event ${event.id} (${event.type}) has no valid upstreamCustomerId`,
      );
      return;
    }
    const upstreamCustomerId = upstreamCustomerIdResult.data;

    let spaceId: Space['id'];
    try {
      spaceId = await this.spacesRepository.findIdByUuid(upstreamCustomerId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
      this.loggingService.warn(
        `Billing webhook event ${event.id} references unknown space ${upstreamCustomerId}`,
      );
      return;
    }

    // The billing-api datasource caches subscriptions in Redis — bust it so
    // the REST read path serves post-event state.
    await this.cacheService.deleteByKey(
      CacheRouter.getBillingSubscriptionsCacheDir({
        upstreamCustomerId,
        status: 'all',
      }).key,
    );
    const features = await this.featuresRepository.getFeatures();
    const featureTypeByKey = new Map(
      features.map((feature) => [feature.key, feature.type]),
    );

    const onWarning = (message: string): void =>
      this.loggingService.warn(message);
    const eventSubscription = mapEventToSubscription({
      event,
      featureTypeByKey,
      onWarning,
    });
    const subscriptions =
      eventSubscription === null
        ? mapUpstreamSubscriptions({
            subscriptions: await this.billingApi.getSubscriptionsByCustomerId({
              upstreamCustomerId,
              status: 'all',
            }),
            featureTypeByKey,
            onWarning,
          })
        : [eventSubscription];

    try {
      await this.entitlementsService.materialize({ spaceId, subscriptions });
    } catch (error) {
      // The space existed a moment ago (resolved just above); a
      // deletion racing this request — caught either as a NotFoundException
      // from materialize()'s own check, or (a narrower window) as the
      // subscriptions insert's FK violation once the space is truly gone —
      // is unprocessable, not retryable.
      if (
        error instanceof NotFoundException ||
        this.isSpaceDeletionRace(error)
      ) {
        this.loggingService.warn(
          `Billing webhook event ${event.id} raced a deletion of space ${upstreamCustomerId}`,
        );
        return;
      }
      throw error;
    }

    this.loggingService.info(
      `Materialized ${subscriptions.length} subscription(s) for space ${spaceId} (event ${event.id}, ${event.type})`,
    );
  }

  /**
   * True for the FK violation `materialize()`'s subscriptions insert raises
   * when the space is deleted between that lookup and this
   * insert — narrower than, and not covered by, the NotFoundException its
   * own upfront existence check throws.
   */
  private isSpaceDeletionRace(error: unknown): boolean {
    return (
      isForeignKeyViolationError(error) &&
      error.driverError.constraint === 'FK_subscriptions_space_id'
    );
  }
}
