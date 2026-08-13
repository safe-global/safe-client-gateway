// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { Subscription } from '@/datasources/billing-api/entities/subscription.entity';
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
  isPaymentLinkEventType,
  isSubscriptionEventType,
  type WebhookEvent,
} from '@/modules/billing/domain/entities/webhook-event.entity';
import type {
  FeatureKey,
  FeatureType,
} from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import {
  isActiveSubscriptionStatus,
  PLAN_NAME_METADATA_KEY,
  parseSubscriptionStatus,
} from '@/modules/entitlements/domain/entitlements.constants';
import { parseFeaturePackage } from '@/modules/entitlements/domain/feature-package.parser';
import { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import type { ISubscriptionSyncService } from '@/modules/entitlements/domain/subscription-sync.service.interface';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';

// Postgres invalid_datetime_format. Raised when an upstream billing period is
// not a representable date, e.g. an epoch outside the range `Date` can hold.
const INVALID_DATETIME_ERROR_CODE = '22007';

const MAX_TIMESTAMP_MS = 8_640_000_000_000_000;

function toEpochDate(epochSeconds: number | null | undefined): Date | null {
  if (epochSeconds == null || !Number.isFinite(epochSeconds)) {
    return null;
  }
  const milliseconds = epochSeconds * 1_000;
  if (Math.abs(milliseconds) > MAX_TIMESTAMP_MS) {
    return null;
  }
  return new Date(milliseconds);
}

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
    if (!isSubscriptionEventType(event.type)) {
      this.loggingService.info(
        `Ignoring billing webhook event type: ${event.type}`,
      );
      return;
    }

    const customer = event.data?.customer;
    if (customer?.customerGroup === 'api') {
      this.loggingService.info(
        `Ignoring billing webhook for 'api' customer group (event ${event.id})`,
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

    const eventSubscription = this.toMaterializedSubscription(
      event,
      featureTypeByKey,
    );
    const subscriptions =
      eventSubscription === null
        ? this.toMaterializedSubscriptions(
            await this.billingApi.getSubscriptionsByCustomerId({
              upstreamCustomerId,
              status: 'all',
            }),
            featureTypeByKey,
          )
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
      // A period the upstream payload cannot express as a date is a data
      // defect, not a transient failure: redelivery carries the same values,
      // so a 5xx here would have the event retried until it expires. Logged
      // at error level because someone has to look at the upstream data.
      if (this.isMalformedUpstreamPeriod(error)) {
        this.loggingService.error(
          `Billing webhook event ${event.id} carries an unrepresentable billing period for space ${upstreamCustomerId}; acking to stop redelivery`,
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
   * Maps the event's own subscription snapshot to its materialized shape, or
   * returns `null` when the payload is not a complete snapshot — the caller
   * then re-fetches the authoritative state instead. A period end is optional:
   * upstream leaves it unset for a subscription that has no end.
   */
  private toMaterializedSubscription(
    event: WebhookEvent,
    featureTypeByKey: Map<FeatureKey, FeatureType>,
  ): MaterializedSubscription | null {
    const data = event.data;
    const upstreamSubscriptionId = data?.subscriptionId;
    const planId = data?.planId;
    if (
      upstreamSubscriptionId == null ||
      upstreamSubscriptionId.length === 0 ||
      planId == null ||
      planId.length === 0 ||
      data?.currentPeriodStart == null
    ) {
      return null;
    }

    const status = parseSubscriptionStatus(data?.status);
    if (status === null) {
      this.loggingService.warn(
        `Billing webhook event ${event.id} carries an unprocessable subscription status: ${data?.status}`,
      );
      return null;
    }

    const toPeriod = (
      epochSeconds: number | null | undefined,
      label: string,
    ): Date | null => {
      const date = toEpochDate(epochSeconds);
      if (epochSeconds != null && date === null) {
        this.loggingService.warn(
          `Billing webhook event ${event.id} carries an unrepresentable ${label}: ${epochSeconds}`,
        );
      }
      return date;
    };

    return {
      upstreamSubscriptionId,
      status,
      planId,
      planName: data?.metadata?.[PLAN_NAME_METADATA_KEY] ?? null,
      currentPeriodStart: toPeriod(data?.currentPeriodStart, 'period start'),
      currentPeriodEnd: toPeriod(data?.currentPeriodEnd, 'period end'),
      entitlements: isActiveSubscriptionStatus(status)
        ? parseFeaturePackage({
            metadata: data?.metadata,
            planFeatures: [],
            featureTypeByKey,
            onWarning: (message) =>
              this.loggingService.warn(
                `Feature package of subscription ${upstreamSubscriptionId}: ${message}`,
              ),
          })
        : null,
    };
  }

  /**
   * Maps upstream subscriptions to their materialized shape, attaching the
   * parsed feature package to the single subscription holding the active
   * slot (newest active-ish one). Upstream anomalies with several active
   * subscriptions are self-healed: the surplus ones are demoted to
   * `canceled` here rather than dropped, so `materialize` writes them and
   * the "one active subscription per space" constraint never sees two rows
   * claiming the active slot on the next sync.
   */
  private toMaterializedSubscriptions(
    subscriptions: Array<Subscription>,
    featureTypeByKey: Map<FeatureKey, FeatureType>,
  ): Array<MaterializedSubscription> {
    const activeSubscriptions = subscriptions
      .filter((subscription) => isActiveSubscriptionStatus(subscription.status))
      .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
    const [active, ...surplusActive] = activeSubscriptions;
    const surplusActiveIds = new Set(
      surplusActive.map((subscription) => subscription.id),
    );

    if (surplusActive.length > 0 && active !== undefined) {
      this.loggingService.warn(
        `Customer ${active.upstreamCustomerId} has ${activeSubscriptions.length} active subscriptions upstream; keeping ${active.id} active and demoting the rest to canceled`,
      );
    }

    return subscriptions.map((subscription) => ({
      upstreamSubscriptionId: subscription.id,
      status: surplusActiveIds.has(subscription.id)
        ? 'canceled'
        : subscription.status,
      planId: subscription.plan.id,
      planName: subscription.plan.name ?? null,
      currentPeriodStart: toEpochDate(subscription.currentPeriodStart),
      currentPeriodEnd: toEpochDate(subscription.currentPeriodEnd),
      entitlements:
        active !== undefined && subscription.id === active.id
          ? parseFeaturePackage({
              metadata: subscription.metadata,
              planFeatures: subscription.plan.features,
              featureTypeByKey,
              onWarning: (message) =>
                this.loggingService.warn(
                  `Feature package of subscription ${subscription.id}: ${message}`,
                ),
            })
          : null,
    }));
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

  private isMalformedUpstreamPeriod(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      'code' in error.driverError &&
      error.driverError.code === INVALID_DATETIME_ERROR_CODE
    );
  }
}
