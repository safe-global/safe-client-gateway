// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Subscription } from '@/datasources/billing-api/entities/subscription.entity';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
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
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import { isActiveSubscriptionStatus } from '@/modules/entitlements/domain/entitlements.constants';
import { IEntitlementsRepository } from '@/modules/entitlements/domain/entitlements.repository.interface';
import { parseFeaturePackage } from '@/modules/entitlements/domain/feature-package.parser';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';

/**
 * Materializes upstream subscription state on billing webhooks.
 *
 * Events are treated as TRIGGERS only: they carry neither the billing
 * periods nor the full feature package, so the authoritative state is always
 * re-fetched from the billing service (after busting its Redis cache). This
 * makes processing idempotent and out-of-order safe by construction — the
 * last write always reflects current upstream truth.
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
    @Inject(IEntitlementsRepository)
    private readonly entitlementsRepository: IEntitlementsRepository,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
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
    const upstreamCustomerId = customer?.upstreamCustomerId;
    if (
      upstreamCustomerId == null ||
      !UuidSchema.safeParse(upstreamCustomerId).success
    ) {
      this.loggingService.warn(
        `Billing webhook event ${event.id} (${event.type}) has no valid upstreamCustomerId`,
      );
      return;
    }

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
      CacheRouter.getBillingSubscriptionsCacheKey(upstreamCustomerId),
    );
    const subscriptions = await this.billingApi.getSubscriptionsByCustomerId({
      upstreamCustomerId,
      status: 'all',
    });

    await this.entitlementsRepository.materialize({
      spaceId,
      subscriptions: this.toMaterializedSubscriptions(subscriptions),
    });
    await this.cacheService.deleteByKey(
      CacheRouter.getSpaceEntitlementsCacheKey(spaceId),
    );

    this.loggingService.info(
      `Materialized ${subscriptions.length} subscription(s) for space ${spaceId} (event ${event.id}, ${event.type})`,
    );
  }

  /**
   * Maps upstream subscriptions to their materialized shape, attaching the
   * parsed feature package to the single subscription holding the active
   * slot (newest active-ish one; upstream anomalies with several are logged
   * and the extras dropped so the "one active per space" invariant holds).
   */
  private toMaterializedSubscriptions(
    subscriptions: Array<Subscription>,
  ): Array<MaterializedSubscription> {
    const activeSubscriptions = subscriptions
      .filter((subscription) => isActiveSubscriptionStatus(subscription.status))
      .sort((a, b) => b.createdAt - a.createdAt);
    const [active, ...surplusActive] = activeSubscriptions;

    if (surplusActive.length > 0) {
      this.loggingService.warn(
        `Customer ${active.upstreamCustomerId} has ${activeSubscriptions.length} active subscriptions upstream; keeping ${active.id} and skipping the rest`,
      );
    }

    return subscriptions
      .filter(
        (subscription) =>
          !surplusActive.some((surplus) => surplus.id === subscription.id),
      )
      .map((subscription) => ({
        upstreamSubscriptionId: subscription.id,
        status: subscription.status,
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
                onWarning: (message) =>
                  this.loggingService.warn(
                    `Feature package of subscription ${subscription.id}: ${message}`,
                  ),
              })
            : null,
      }));
  }

  private async findSpaceIdByUuid(uuid: string): Promise<number | null> {
    const dataSource =
      await this.postgresDatabaseService.initializeDatabaseConnection();
    const space = await dataSource.manager.findOne(Space, {
      where: { uuid: uuid as Space['uuid'] },
      select: { id: true },
    });
    return space?.id ?? null;
  }
}
