// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import type { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import type {
  ResolvedEntitlement,
  ResolvedEntitlements,
} from '@/modules/entitlements/domain/entities/resolved-entitlements.entity';
import type { StockMeteredFeature } from '@/modules/entitlements/domain/entitlements.constants';
import {
  isActiveSubscriptionStatus,
  isStockMeteredFeature,
} from '@/modules/entitlements/domain/entitlements.constants';
import {
  effectiveEntitlement,
  enforceableQuota,
  eventPeriodStart,
  isBeforeEnforcementLaunch,
  isGrandfathered,
  isOverSeat,
  resetsAt,
  selectOverSeatSafeIds,
} from '@/modules/entitlements/domain/entitlements.rules';
import { QuotaExceededError } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import { ISpaceFeatureUsageRepository } from '@/modules/entitlements/domain/space-feature-usage.repository.interface';
import { ISpaceSeatSelectionRepository } from '@/modules/entitlements/domain/space-seat-selection.repository.interface';
import { ISubscriptionEntitlementsRepository } from '@/modules/entitlements/domain/subscription-entitlements.repository.interface';
import { ISubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

/**
 * Orchestrates the entitlements feature: reads rows through the per-table
 * repositories, applies the pure rules in `entitlements.rules`, and owns the
 * transactions spanning several tables.
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
    @Inject(ISpaceSeatSelectionRepository)
    private readonly spaceSeatSelectionRepository: ISpaceSeatSelectionRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

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

    const hasEverSubscribed = await this.hasEverSubscribed({
      spaceId,
      spaceCreatedAt,
      activeSubscription,
    });

    const usedByFeatureId = await this.getUsageByFeatureId({
      spaceId,
      spaceCreatedAt,
      features,
      activeSubscription,
      now,
    });

    const entitlements = features.map((feature) =>
      this.resolve({
        feature,
        spaceCreatedAt,
        activeSubscription,
        hasEverSubscribed,
        used: usedByFeatureId.get(feature.id) ?? 0,
        now,
      }),
    );

    const seats = entitlements.find(
      (entitlement) => entitlement.feature === 'safe_seats',
    );
    const overSeat =
      seats?.type === 'metered' &&
      isOverSeat({
        quota: seats.quota ?? null,
        used: seats.used ?? 0,
        grandfathered: seats.grandfathered ?? false,
      });

    return {
      plan: activeSubscription
        ? {
            id: activeSubscription.planId,
            name: activeSubscription.planName,
            cycleEndsAt: activeSubscription.currentPeriodEnd,
          }
        : null,
      entitlements,
      overSeatSafeIds: overSeat
        ? await this.computeOverSeatSafeIds(spaceId, seats.quota as number)
        : [],
    };
  }

  /**
   * Guard to run *before* a mutation that consumes quota (adding a Safe,
   * inviting a member): throws `QuotaExceededError` (402) when the increment
   * would exceed the workspace's effective quota. Unlimited never throws.
   *
   * Pass the transactional `entityManager` performing the mutation so the
   * count sees the caller's own uncommitted rows (a batch must see its
   * earlier inserts). It also serializes concurrent checks for the same
   * workspace via a session-scoped advisory lock (released automatically at
   * transaction end), so two callers racing to add the last available seat
   * cannot both pass the check before either commits its mutation.
   */
  public async checkQuotaOrFail(args: {
    spaceId: Space['id'];
    featureKey: FeatureKey;
    increment: number;
    entityManager?: EntityManager;
  }): Promise<void> {
    if (args.entityManager) {
      await this.subscriptionsRepository.lockSpaceForQuotaCheck(
        args.spaceId,
        args.entityManager,
      );
    }

    const now = new Date();
    const spaceCreatedAt = await this.getSpaceCreatedAtOrFail(args.spaceId);
    const feature = await this.getFeatureOrFail(
      args.featureKey,
      args.entityManager,
    );
    const activeSubscription =
      await this.subscriptionsRepository.getActiveSubscriptionBySpaceId(
        args.spaceId,
        args.entityManager,
      );

    const quota = enforceableQuota(
      this.effectiveFor(feature, activeSubscription),
    );
    if (quota === null) {
      return;
    }

    const used = await this.getUsage({
      spaceId: args.spaceId,
      spaceCreatedAt,
      feature,
      activeSubscription,
      now,
      entityManager: args.entityManager,
    });
    if (used + args.increment > quota) {
      throw new QuotaExceededError({
        feature: args.featureKey,
        quota,
        used,
        resetsAt: resetsAt({
          feature,
          spaceCreatedAt,
          cycle: activeSubscription,
          now,
        }),
      });
    }
  }

  /**
   * Records event-type consumption (a gas-sponsored transaction, a Copilot
   * report). The increment enforces the quota in the same statement, so
   * concurrent consumers cannot overshoot it.
   */
  public async consume(args: {
    spaceId: Space['id'];
    featureKey: FeatureKey;
    amount?: number;
  }): Promise<{ used: number; quota: number | null }> {
    const amount = args.amount ?? 1;
    if (isStockMeteredFeature(args.featureKey)) {
      throw new Error(
        `${args.featureKey} is counted live from its own table, not consumed`,
      );
    }

    const now = new Date();
    const spaceCreatedAt = await this.getSpaceCreatedAtOrFail(args.spaceId);
    const feature = await this.getFeatureOrFail(args.featureKey);
    if (feature.type !== 'metered') {
      throw new Error(`${args.featureKey} is not a metered feature`);
    }
    const activeSubscription =
      await this.subscriptionsRepository.getActiveSubscriptionBySpaceId(
        args.spaceId,
      );

    const quota = enforceableQuota(
      this.effectiveFor(feature, activeSubscription),
    );
    const key = {
      spaceId: args.spaceId,
      featureId: feature.id,
      periodStart: eventPeriodStart({
        feature,
        spaceCreatedAt,
        cycle: activeSubscription,
        now,
      }),
    };

    return await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        await this.spaceFeatureUsageRepository.createUsageIfMissing(
          key,
          entityManager,
        );
        const used =
          await this.spaceFeatureUsageRepository.increaseUsageWithinQuota(
            { ...key, amount, quota },
            entityManager,
          );

        if (used === null) {
          throw new QuotaExceededError({
            feature: args.featureKey,
            quota: quota as number,
            used: await this.spaceFeatureUsageRepository.getUsage(
              key,
              entityManager,
            ),
            resetsAt: resetsAt({
              feature,
              spaceCreatedAt,
              cycle: activeSubscription,
              now,
            }),
          });
        }
        return { used, quota };
      },
    );
  }

  /**
   * Idempotently materializes the upstream subscription state of a workspace:
   * upserts every subscription row by `upstreamSubscriptionId` and replaces
   * the active subscription's entitlement package wholesale, in one
   * transaction.
   */
  public async materialize(args: {
    spaceId: Space['id'];
    subscriptions: Array<MaterializedSubscription>;
  }): Promise<void> {
    await this.getSpaceCreatedAtOrFail(args.spaceId);
    const features = await this.featuresRepository.getFeatures();
    const featureIdByKey = new Map(
      features.map((feature) => [feature.key, feature.id]),
    );

    // Demotions (e.g. active → canceled) run before promotions so the "one
    // active subscription per space" partial unique index never sees both the
    // outgoing and the incoming subscription active at once.
    const orderedSubscriptions = [...args.subscriptions].sort(
      (left, right) =>
        Number(isActiveSubscriptionStatus(left.status)) -
        Number(isActiveSubscriptionStatus(right.status)),
    );

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      let activeRowId: number | null = null;
      let activePackage: MaterializedSubscription['entitlements'] = null;

      for (const subscription of orderedSubscriptions) {
        const values = {
          status: subscription.status,
          planId: subscription.planId,
          planName: subscription.planName,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
        };
        const existing =
          await this.subscriptionsRepository.getSubscriptionByUpstreamId(
            subscription.upstreamSubscriptionId,
            entityManager,
          );

        let rowId: number;
        if (existing) {
          await this.subscriptionsRepository.updateSubscription(
            { id: existing.id, values },
            entityManager,
          );
          rowId = existing.id;
        } else {
          rowId = await this.subscriptionsRepository.createSubscription(
            {
              spaceId: args.spaceId,
              upstreamSubscriptionId: subscription.upstreamSubscriptionId,
              values,
            },
            entityManager,
          );
        }

        if (subscription.entitlements !== null) {
          activeRowId = rowId;
          activePackage = subscription.entitlements;
        }
      }

      if (activeRowId !== null && activePackage !== null) {
        // Full replace: reprocessing the same upstream state yields the same
        // rows (idempotent by construction).
        await this.subscriptionEntitlementsRepository.deleteEntitlementsBySubscriptionId(
          activeRowId,
          entityManager,
        );
        await this.subscriptionEntitlementsRepository.createEntitlements(
          {
            subscriptionId: activeRowId,
            entitlements: activePackage.flatMap((entitlement) => {
              const featureId = featureIdByKey.get(entitlement.featureKey);
              // Unknown keys are dropped by the parser; guard anyway.
              return featureId === undefined
                ? []
                : [
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
    });
  }

  /** Replaces the admin's explicit choice of covered Safes. */
  public async replaceSeatSelection(args: {
    spaceId: Space['id'];
    spaceSafeIds: Array<number>;
  }): Promise<void> {
    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const ownSafeIds = new Set(
        await this.spaceSafesRepository.getIdsBySpaceIdOldestFirst(
          args.spaceId,
          entityManager,
        ),
      );
      // Fail closed rather than silently dropping the id: a Safe id from
      // another workspace should never reach the insert below. Kept generic
      // (no id in the message) so a caller cannot use this to probe which
      // Safe ids exist elsewhere.
      if (args.spaceSafeIds.some((id) => !ownSafeIds.has(id))) {
        throw new NotFoundException('Workspace Safe not found.');
      }

      await this.spaceSeatSelectionRepository.deleteSelectionBySpaceId(
        args.spaceId,
        entityManager,
      );
      await this.spaceSeatSelectionRepository.createSelection(
        args,
        entityManager,
      );
    });
  }

  private resolve(args: {
    feature: Feature;
    spaceCreatedAt: Date;
    activeSubscription: SpaceSubscription | null;
    hasEverSubscribed: boolean;
    used: number;
    now: Date;
  }): ResolvedEntitlement {
    const { feature, spaceCreatedAt, activeSubscription, used, now } = args;
    const effective = this.effectiveFor(feature, activeSubscription);

    if (feature.type === 'binary') {
      return {
        feature: feature.key,
        type: 'binary',
        enabled: effective.enabled,
      };
    }
    if (feature.type === 'value') {
      return {
        feature: feature.key,
        type: 'value',
        enabled: effective.enabled,
        value: effective.value,
      };
    }

    return {
      feature: feature.key,
      type: 'metered',
      enabled: effective.enabled,
      // Always the plan's quota, never inflated to match usage.
      quota: effective.quota,
      used,
      resetsAt: resetsAt({
        feature,
        spaceCreatedAt,
        cycle: activeSubscription,
        now,
      }),
      grandfathered: isGrandfathered({
        spaceCreatedAt,
        hasEverSubscribed: args.hasEverSubscribed,
        quota: effective.quota,
        used,
      }),
    };
  }

  /** Effective entitlement of a feature under the workspace's current plan. */
  private effectiveFor(
    feature: Feature,
    activeSubscription: SpaceSubscription | null,
  ): ReturnType<typeof effectiveEntitlement> {
    return effectiveEntitlement({
      feature,
      purchased: this.purchasedFor(feature, activeSubscription),
    });
  }

  private purchasedFor(
    feature: Feature,
    activeSubscription: SpaceSubscription | null,
  ):
    | { enabled: boolean; quota: number | null; value: string | null }
    | undefined {
    return activeSubscription?.entitlements?.find(
      (entitlement) => entitlement.feature.id === feature.id,
    );
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
      (feature) => feature.type === 'metered',
    );
    const eventMetered = metered.filter(
      (feature) => !isStockMeteredFeature(feature.key),
    );

    const eventUsage =
      await this.spaceFeatureUsageRepository.getUsageByFeatureId({
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

    const stockUsage = await Promise.all(
      metered
        .filter((feature) => isStockMeteredFeature(feature.key))
        .map(async (feature) => {
          const used = await this.stockCounters[
            feature.key as StockMeteredFeature
          ](args.spaceId);
          return [feature.id, used] as const;
        }),
    );

    return new Map([...eventUsage, ...stockUsage]);
  }

  /** Usage of a single metered feature, whichever way it is counted. */
  private async getUsage(args: {
    spaceId: Space['id'];
    spaceCreatedAt: Date;
    feature: Feature;
    activeSubscription: SpaceSubscription | null;
    now: Date;
    entityManager?: EntityManager;
  }): Promise<number> {
    const { feature } = args;
    if (isStockMeteredFeature(feature.key)) {
      return await this.stockCounters[feature.key](
        args.spaceId,
        args.entityManager,
      );
    }
    return await this.spaceFeatureUsageRepository.getUsage(
      {
        spaceId: args.spaceId,
        featureId: feature.id,
        periodStart: eventPeriodStart({
          feature,
          spaceCreatedAt: args.spaceCreatedAt,
          cycle: args.activeSubscription,
          now: args.now,
        }),
      },
      args.entityManager,
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
    (spaceId: Space['id'], entityManager?: EntityManager) => Promise<number>
  > = {
    safe_seats: (spaceId, entityManager) =>
      this.spaceSafesRepository.countBySpaceId(spaceId, entityManager),
    members: (spaceId, entityManager) =>
      this.membersRepository.countActiveOrPendingBySpaceId(
        spaceId,
        entityManager,
      ),
  };

  private async computeOverSeatSafeIds(
    spaceId: Space['id'],
    quota: number,
  ): Promise<Array<number>> {
    const [safeIdsOldestFirst, selectedSafeIds] = await Promise.all([
      this.spaceSafesRepository.getIdsBySpaceIdOldestFirst(spaceId),
      this.spaceSeatSelectionRepository.getSelectedSpaceSafeIds(spaceId),
    ]);
    return selectOverSeatSafeIds({
      safeIdsOldestFirst,
      selectedSafeIds,
      quota,
    });
  }

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

  /** Whether the workspace has ever had a subscription, active or terminal. */
  private async hasEverSubscribed(args: {
    spaceId: Space['id'];
    spaceCreatedAt: Date;
    activeSubscription: SpaceSubscription | null;
  }): Promise<boolean> {
    if (args.activeSubscription !== null) {
      return true;
    }
    if (!isBeforeEnforcementLaunch(args.spaceCreatedAt)) {
      return false;
    }
    return (
      (await this.subscriptionsRepository.countSubscriptionsBySpaceId(
        args.spaceId,
      )) > 0
    );
  }

  private async getFeatureOrFail(
    featureKey: FeatureKey,
    entityManager?: EntityManager,
  ): Promise<Feature> {
    const feature = await this.featuresRepository.getFeatureByKey(
      featureKey,
      entityManager,
    );
    if (!feature) {
      throw new Error(`Feature ${featureKey} is missing from the catalog`);
    }
    return feature;
  }
}
