// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import type { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import type {
  ResolvedEntitlement,
  ResolvedEntitlements,
} from '@/modules/entitlements/domain/entities/resolved-entitlements.entity';
import type { StockMeteredFeature } from '@/modules/entitlements/domain/entitlements.constants';
import {
  isActiveSubscriptionStatus,
  isStockMeteredFeature,
  ordersAfter,
} from '@/modules/entitlements/domain/entitlements.constants';
import {
  effectiveEntitlement,
  eventPeriodStart,
  isOverLimit,
  resetsAt,
} from '@/modules/entitlements/domain/entitlements.rules';
import { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import { ISpaceFeatureUsageRepository } from '@/modules/entitlements/domain/space-feature-usage.repository.interface';
import { ISubscriptionEntitlementsRepository } from '@/modules/entitlements/domain/subscription-entitlements.repository.interface';
import { ISubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository.interface';
import type { EntitlementsResponse } from '@/modules/entitlements/routes/entities/entitlements-response.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

/**
 * Orchestrates the entitlements feature: reads and writes rows through the
 * per-table repositories, applies the pure rules in `entitlements.rules`,
 * and owns the transactions spanning several tables.
 */
@Injectable()
export class EntitlementsService {
  public constructor(
    @Inject(IFeaturesRepository)
    private readonly featuresRepository: IFeaturesRepository,
    @Inject(ISubscriptionsRepository)
    private readonly subscriptionsRepository: ISubscriptionsRepository,
    @Inject(ISubscriptionEntitlementsRepository)
    private readonly subscriptionEntitlementsRepository: ISubscriptionEntitlementsRepository,
    @Inject(ISpaceFeatureUsageRepository)
    private readonly spaceFeatureUsageRepository: ISpaceFeatureUsageRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Resolves the workspace's entitlements.
   */
  public async resolveEntitlements(
    spaceId: Space['id'],
  ): Promise<ResolvedEntitlements> {
    const now = new Date();
    // Independent reads: the usage lookup below is the first step that needs
    // their results.
    const [spaceCreatedAt, features, activeSubscription] = await Promise.all([
      this.getSpaceCreatedAtOrFail(spaceId),
      this.featuresRepository.getFeatures(),
      this.subscriptionsRepository.getActiveSubscriptionBySpaceId(spaceId),
    ]);

    const usedByFeatureId = await this.getUsageByFeatureId({
      spaceId,
      spaceCreatedAt,
      features,
      activeSubscription,
      now,
    });

    const entitlements = features.map((feature) =>
      this.resolveFeature({
        feature,
        spaceCreatedAt,
        activeSubscription,
        used: usedByFeatureId.get(feature.id) ?? 0,
        now,
      }),
    );

    return {
      plan: activeSubscription
        ? {
            id: activeSubscription.planId,
            name: activeSubscription.planName,
            cycleEndsAt: activeSubscription.currentPeriodEnd,
          }
        : null,
      entitlements,
    };
  }

  /** `GET /v1/spaces/:spaceId/entitlements`: any active member can read it. */
  public async getEntitlements(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
  }): Promise<EntitlementsResponse> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    return this.toEntitlementsResponse(
      await this.resolveEntitlements(args.spaceId),
    );
  }
  /**
   * Materializes the state an event carries in its own payload, and stamps the
   * space with that event's `created`. Applied only while it orders strictly
   * after the mark already stored — decided here, inside the transaction that
   * holds the space's lock, so the answer cannot go stale between the check and
   * the write. `false` means nothing was written and the caller should ask
   * upstream instead.
   */
  public async materializeFromEvent(args: {
    spaceId: Space['id'];
    subscription: MaterializedSubscription;
    eventAt: Date;
  }): Promise<boolean> {
    return await this.materializeUnderLock({
      spaceId: args.spaceId,
      subscriptions: [args.subscription],
      admit: (storedEventAt) => {
        if (!ordersAfter(args.eventAt, storedEventAt)) {
          this.loggingService.debug(
            `Space ${args.spaceId} kept its state: an event stamped ${args.eventAt.toISOString()} does not order after the materialized ${this.markLabel(storedEventAt)}`,
          );
          return null;
        }
        return { lastEventAt: args.eventAt };
      },
    });
  }

  /**
   * Materializes state read from the billing service, which is current as of
   * when the fetch went out rather than as of any event. `observedEventAt` is
   * the mark read just before that fetch: if it has moved by the time the lock
   * is held, a concurrent delivery has written something this snapshot may
   * predate, so nothing is written and `false` says to look again. The stamp
   * only ever rises — the later of what is stored and the triggering event.
   */
  public async materializeAuthoritative(args: {
    spaceId: Space['id'];
    subscriptions: Array<MaterializedSubscription>;
    observedEventAt: Date | null;
    triggerEventAt: Date | null;
  }): Promise<boolean> {
    return await this.materializeUnderLock({
      spaceId: args.spaceId,
      subscriptions: args.subscriptions,
      admit: (storedEventAt) => {
        if (storedEventAt?.getTime() !== args.observedEventAt?.getTime()) {
          this.loggingService.warn(
            `Space ${args.spaceId} moved from ${this.markLabel(args.observedEventAt)} to ${this.markLabel(storedEventAt)} while its authoritative state was being read; nothing written`,
          );
          return null;
        }
        return {
          lastEventAt: this.laterOf(storedEventAt, args.triggerEventAt),
        };
      },
    });
  }

  /**
   * Idempotently materializes the upstream subscription state of a workspace:
   * upserts every subscription row by `upstreamSubscriptionId` and replaces
   * the active subscription's entitlement package wholesale, in one
   * transaction.
   *
   * `admit` is the caller's rule, applied to the mark this method holds under
   * the space's lock: it returns the stamp to write, or `null` to abandon the
   * write and log why.
   */
  private async materializeUnderLock(args: {
    spaceId: Space['id'];
    subscriptions: Array<MaterializedSubscription>;
    admit: (storedEventAt: Date | null) => { lastEventAt: Date | null } | null;
  }): Promise<boolean> {
    // Existence check: throws when the space is gone.
    await this.spacesRepository.findUuidById(args.spaceId);

    const withPackage = args.subscriptions.filter(
      (subscription) => subscription.entitlements !== null,
    );
    if (withPackage.length > 1) {
      throw new Error(
        `Materializing space ${args.spaceId} got ${withPackage.length} subscriptions carrying an entitlement package; expected at most 1`,
      );
    }

    const activeIsh = args.subscriptions.filter((subscription) =>
      isActiveSubscriptionStatus(subscription.status),
    );
    if (activeIsh.length > 1) {
      throw new Error(
        `Materializing space ${args.spaceId} got ${activeIsh.length} active-ish subscriptions; expected at most 1`,
      );
    }

    // Only the subscription holding the active slot carries a package, and
    // there is at most one (asserted above) — so the catalog is needed only
    // when that subscription is present.
    const packaged = withPackage.at(0);
    const featureIdByKey =
      packaged === undefined
        ? new Map<string, number>()
        : new Map(
            (await this.featuresRepository.getFeatures()).map((feature) => [
              feature.key,
              feature.id,
            ]),
          );

    const incomingActive = activeIsh.at(0);

    return await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        // Serializes concurrent webhooks for this space, so the mark read below
        // is what the write is actually ordered against.
        await this.subscriptionsRepository.lockSpaceForSync(
          args.spaceId,
          entityManager,
        );
        const storedEventAt = await this.subscriptionsRepository.getLastEventAt(
          args.spaceId,
          entityManager,
        );
        const admitted = args.admit(storedEventAt);
        if (admitted === null) {
          return false;
        }
        const { lastEventAt } = admitted;

        let activeSubscriptionId: number | null = null;

        // Frees the "one active subscription per space" slot before the upserts
        // below claim it: on a plan change the outgoing subscription is still
        // active here, and its own event may not have arrived yet. Running it
        // first is also what lets the upserts below go in any order — no other
        // row can hold the slot by the time they run.
        if (incomingActive !== undefined) {
          await this.subscriptionsRepository.demoteActiveSubscriptions(
            {
              spaceId: args.spaceId,
              exceptUpstreamSubscriptionId:
                incomingActive.upstreamSubscriptionId,
              lastEventAt,
            },
            entityManager,
          );
        }

        for (const subscription of args.subscriptions) {
          const subscriptionId =
            await this.subscriptionsRepository.upsertSubscription(
              {
                spaceId: args.spaceId,
                upstreamSubscriptionId: subscription.upstreamSubscriptionId,
                values: {
                  status: subscription.status,
                  planId: subscription.planId,
                  planName: subscription.planName,
                  currentPeriodStart: subscription.currentPeriodStart,
                  currentPeriodEnd: subscription.currentPeriodEnd,
                  lastEventAt,
                },
              },
              entityManager,
            );

          if (subscription.entitlements !== null) {
            activeSubscriptionId = subscriptionId;
          }
        }

        if (activeSubscriptionId !== null && packaged?.entitlements != null) {
          // Full replace: reprocessing the same upstream state yields the same
          // rows (idempotent by construction).
          await this.subscriptionEntitlementsRepository.deleteEntitlementsBySubscriptionId(
            activeSubscriptionId,
            entityManager,
          );
          await this.subscriptionEntitlementsRepository.createEntitlements(
            {
              subscriptionId: activeSubscriptionId,
              entitlements: packaged.entitlements.flatMap((entitlement) => {
                const featureId = featureIdByKey.get(entitlement.featureKey);
                if (featureId === undefined) {
                  // The parser already drops unknown keys against its own
                  // catalog snapshot; reaching this means the feature was
                  // renamed/deleted in the narrow window before this
                  // independent re-fetch. Rare, but silently dropping a
                  // purchased entitlement is worth a trace.
                  this.loggingService.warn(
                    `Space ${args.spaceId} dropped unknown feature key '${entitlement.featureKey}' on subscription ${packaged.upstreamSubscriptionId}`,
                  );
                  return [];
                }
                return [
                  {
                    featureId,
                    enabled: entitlement.enabled,
                    quota: entitlement.quota,
                    value: entitlement.value,
                  },
                ];
              }),
            },
            entityManager,
          );
        }

        return true;
      },
    );
  }

  private markLabel(mark: Date | null): string {
    return mark?.toISOString() ?? 'unset';
  }

  private laterOf(
    storedEventAt: Date | null,
    triggerEventAt: Date | null,
  ): Date | null {
    if (storedEventAt === null) return triggerEventAt;
    if (triggerEventAt === null) return storedEventAt;
    return storedEventAt > triggerEventAt ? storedEventAt : triggerEventAt;
  }

  private resolveFeature(args: {
    feature: Feature;
    spaceCreatedAt: Date;
    activeSubscription: SpaceSubscription | null;
    used: number;
    now: Date;
  }): ResolvedEntitlement {
    const { feature, spaceCreatedAt, activeSubscription, used, now } = args;
    const effective = effectiveEntitlement({
      feature,
      purchased: activeSubscription?.entitlements?.find(
        (entitlement) => entitlement.feature.id === feature.id,
      ),
    });

    if (feature.type === FeatureType.Binary) {
      return {
        feature: feature.key,
        type: FeatureType.Binary,
        enabled: effective.enabled,
      };
    }
    if (feature.type === FeatureType.Value) {
      return {
        feature: feature.key,
        type: FeatureType.Value,
        enabled: effective.enabled,
        value: effective.value,
      };
    }

    return {
      feature: feature.key,
      type: FeatureType.Metered,
      enabled: effective.enabled,
      // Always the plan's quota, never inflated to match usage.
      quota: effective.quota,
      used,
      overLimit: isOverLimit({ quota: effective.quota, used }),
      resetsAt: resetsAt({
        feature,
        spaceCreatedAt,
        cycle: activeSubscription,
        now,
      }),
    };
  }

  /** Usage of every metered feature in the catalog, keyed by feature id. */
  private async getUsageByFeatureId(args: {
    spaceId: Space['id'];
    spaceCreatedAt: Date;
    features: Array<Feature>;
    activeSubscription: SpaceSubscription | null;
    now: Date;
  }): Promise<Map<number, number>> {
    const metered = args.features.filter(
      (feature) => feature.type === FeatureType.Metered,
    );

    const [eventUsage, stockUsage] = await Promise.all([
      this.getEventUsage({ ...args, features: metered }),
      this.getStockUsage(args.spaceId, metered.filter(isStockMeteredFeature)),
    ]);

    return new Map([...eventUsage, ...stockUsage]);
  }

  /** One query covering every event-metered feature's current period. */
  private async getEventUsage(args: {
    spaceId: Space['id'];
    spaceCreatedAt: Date;
    features: Array<Feature>;
    activeSubscription: SpaceSubscription | null;
    now: Date;
  }): Promise<Map<number, number>> {
    const eventMetered = args.features.filter(
      (feature) => !isStockMeteredFeature(feature),
    );

    return await this.spaceFeatureUsageRepository.getUsageByFeatureId({
      spaceId: args.spaceId,
      periods: eventMetered.map((feature) => ({
        featureId: feature.id,
        periodStart: eventPeriodStart({
          feature,
          spaceCreatedAt: args.spaceCreatedAt,
          cycle: args.activeSubscription,
          now: args.now,
        }),
      })),
    });
  }

  /** One live count per stock-metered feature, run concurrently. */
  private async getStockUsage(
    spaceId: Space['id'],
    features: Array<Feature & { key: StockMeteredFeature }>,
  ): Promise<Array<readonly [number, number]>> {
    return await Promise.all(
      features.map(
        async (feature) =>
          [feature.id, await this.stockCounters[feature.key](spaceId)] as const,
      ),
    );
  }

  /**
   * Stock usage is a live count owned by the feature's own module, so it is
   * read through that module's repository rather than from `entitlements`.
   * Exhaustive by construction: a new key in `STOCK_METERED_FEATURES` does not
   * compile until its counter is added here.
   */
  private readonly stockCounters: Record<
    StockMeteredFeature,
    (spaceId: Space['id']) => Promise<number>
  > = {
    safe_seats: (spaceId) => this.spaceSafesRepository.countBySpaceId(spaceId),
  };

  private async getSpaceCreatedAtOrFail(spaceId: Space['id']): Promise<Date> {
    const space = await this.spacesRepository.findOne({
      where: { id: spaceId },
      select: { createdAt: true },
    });
    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }
    return space.createdAt;
  }

  private toEntitlementsResponse(
    resolved: ResolvedEntitlements,
  ): EntitlementsResponse {
    return {
      plan: resolved.plan
        ? {
            id: resolved.plan.id,
            name: resolved.plan.name,
            cycleEndsAt: resolved.plan.cycleEndsAt,
          }
        : null,
      entitlements: resolved.entitlements,
    };
  }
}
