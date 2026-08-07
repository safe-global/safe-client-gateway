// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Subscription } from '@/datasources/billing-api/entities/subscription.entity';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  isPaymentLinkEventType,
  isSubscriptionEventType,
  WebhookEventSchema,
} from '@/modules/billing/domain/entities/webhook-event.entity';
import type {
  FeatureKey,
  FeatureType,
} from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import { isActiveSubscriptionStatus } from '@/modules/entitlements/domain/entitlements.constants';
import { parseFeaturePackage } from '@/modules/entitlements/domain/feature-package.parser';
import { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';

/**
 * Materializes upstream subscription state on billing webhooks.
 *
 * Events are treated as TRIGGERS only: they carry neither the billing
 * periods nor the full feature package, so the authoritative state is always
 * re-fetched from the billing service (after busting its Redis cache). This
 * makes processing idempotent and out-of-order safe by construction — the
 * last write always reflects current upstream truth, regardless of the
 * delivery order of the events that triggered it.
 *
 * This deliberately deviates from the RFC's wording ("replace the package
 * from the FEATURE_* metadata coming inside the event"): trusting the
 * event's own metadata instead of re-fetching would let a late-delivered
 * stale event overwrite a correctly-applied newer one.
 *
 * Unprocessable-but-authenticated payloads (malformed body, unknown space,
 * `api` customer group) are logged and acked: retrying cannot fix them.
 * Fetch/DB errors propagate as 5xx so the billing service's retry mechanism
 * provides durability.
 */
@Injectable()
export class SubscriptionSyncService {
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

  public async handleWebhook(payload: unknown): Promise<void> {
    const result = WebhookEventSchema.safeParse(payload);
    if (!result.success) {
      this.loggingService.error(
        `Malformed billing webhook payload: ${result.error.message}`,
      );
      return;
    }
    const event = result.data;

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

    const spaceId = await this.findSpaceIdByUuid(upstreamCustomerId);
    if (spaceId === null) {
      this.loggingService.warn(
        `Billing webhook event ${event.id} references unknown space ${upstreamCustomerId}`,
      );
      return;
    }

    // The billing-api datasource caches subscriptions in Redis — bust it so
    // the re-fetch below returns post-event state.
    await this.cacheService.deleteByKey(
      CacheRouter.getBillingSubscriptionsCacheDir({
        upstreamCustomerId,
        status: 'all',
      }).key,
    );
    // Independent reads: fetched in parallel.
    const [subscriptions, features] = await Promise.all([
      this.billingApi.getSubscriptionsByCustomerId({
        upstreamCustomerId,
        status: 'all',
      }),
      this.featuresRepository.getFeatures(),
    ]);
    const featureTypeByKey = new Map(
      features.map((feature) => [feature.key, feature.type]),
    );

    try {
      await this.entitlementsService.materialize({
        spaceId,
        subscriptions: this.toMaterializedSubscriptions(
          subscriptions,
          featureTypeByKey,
        ),
      });
    } catch (error) {
      // The space existed a moment ago (`findSpaceIdByUuid` above); a
      // deletion racing this request is unprocessable, not retryable.
      if (error instanceof NotFoundException) {
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
      currentPeriodStart: new Date(subscription.startAt * 1_000),
      currentPeriodEnd:
        subscription.validUntil == null
          ? null
          : new Date(subscription.validUntil * 1_000),
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

  private async findSpaceIdByUuid(
    uuid: Space['uuid'],
  ): Promise<Space['id'] | null> {
    try {
      return await this.spacesRepository.findIdByUuid(uuid);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }
}
