// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type EntityManager, In } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import { SpaceSeatSelection } from '@/modules/entitlements/datasources/entities/space-seat-selection.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import type {
  ResolvedEntitlement,
  ResolvedEntitlements,
} from '@/modules/entitlements/domain/entities/resolved-entitlements.entity';
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  ENFORCEMENT_LAUNCH_DATE,
  isActiveSubscriptionStatus,
  isStockMeteredFeature,
} from '@/modules/entitlements/domain/entitlements.constants';
import type { IEntitlementsRepository } from '@/modules/entitlements/domain/entitlements.repository.interface';
import { QuotaExceededError } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { activeOrPendingMemberWhere } from '@/modules/users/domain/members/utils/members.utils';

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

/** The effective entitlement of one feature: subscription row or Free fallback. */
type EffectiveEntitlement = {
  space: Pick<Space, 'id' | 'createdAt'>;
  feature: Feature;
  activeSubscription: SpaceSubscription | null;
  enabled: boolean;
  quota: number | null;
  value: string | null;
};

@Injectable()
export class EntitlementsRepository implements IEntitlementsRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async resolveEntitlements(
    spaceId: Space['id'],
  ): Promise<ResolvedEntitlements> {
    const entityManager = await this.getManager();
    const now = new Date();

    const space = await this.findSpaceOrFail(entityManager, spaceId);
    const features = await entityManager.find(Feature, {
      order: { id: 'ASC' },
    });
    const activeSubscription = await this.findActiveSubscription(
      entityManager,
      spaceId,
    );
    const hasEverSubscribed =
      activeSubscription !== null ||
      (await entityManager.count(SpaceSubscription, {
        where: { space: { id: spaceId } },
      })) > 0;

    const packageByFeatureId = new Map<number, SubscriptionEntitlement>(
      (activeSubscription?.entitlements ?? []).map((row) => [
        row.feature.id,
        row,
      ]),
    );

    const safesUsed = await entityManager.count(SpaceSafe, {
      where: { space: { id: spaceId } },
    });
    const membersUsed = await entityManager.count(Member, {
      where: activeOrPendingMemberWhere<Member>(() => ({
        space: { id: spaceId },
      })),
    });
    const usageByFeatureId = await this.getEventUsage({
      entityManager,
      space,
      features,
      activeSubscription,
      now,
    });

    const usedFor = (feature: Feature): number => {
      if (feature.key === 'safe_seats') {
        return safesUsed;
      }
      if (feature.key === 'members') {
        return membersUsed;
      }
      return usageByFeatureId.get(feature.id) ?? 0;
    };

    const entitlements = features.map((feature): ResolvedEntitlement => {
      const row = activeSubscription
        ? packageByFeatureId.get(feature.id)
        : undefined;
      const enabled = row ? row.enabled : feature.freeEnabled;

      if (feature.type === 'binary') {
        return { feature: feature.key, type: 'binary', enabled };
      }
      if (feature.type === 'value') {
        return {
          feature: feature.key,
          type: 'value',
          enabled,
          value: row ? row.value : feature.freeValue,
        };
      }

      const quota = row ? row.quota : feature.freeQuota;
      const used = usedFor(feature);
      return {
        feature: feature.key,
        type: 'metered',
        enabled,
        quota,
        used,
        resetsAt: this.resetsAtFor({
          feature,
          space,
          activeSubscription,
          now,
        }),
        grandfathered:
          space.createdAt < ENFORCEMENT_LAUNCH_DATE &&
          !hasEverSubscribed &&
          quota !== null &&
          used > quota,
      };
    });

    const seats = entitlements.find(
      (entitlement) => entitlement.feature === 'safe_seats',
    );
    const isOverSeat =
      seats?.type === 'metered' &&
      typeof seats.quota === 'number' &&
      typeof seats.used === 'number' &&
      seats.used > seats.quota &&
      !seats.grandfathered;

    return {
      plan: activeSubscription
        ? {
            id: activeSubscription.planId,
            name: activeSubscription.planName,
            cycleEndsAt: activeSubscription.currentPeriodEnd,
          }
        : null,
      entitlements,
      overSeatSafeIds: isOverSeat
        ? await this.computeOverSeatSafeIds(
            entityManager,
            spaceId,
            seats.quota as number,
          )
        : [],
    };
  }

  public async checkQuotaOrFail(args: {
    spaceId: Space['id'];
    featureKey: FeatureKey;
    increment: number;
    entityManager?: EntityManager;
  }): Promise<void> {
    const entityManager = await this.getManager(args.entityManager);
    const now = new Date();

    const effective = await this.getEffectiveEntitlement(
      entityManager,
      args.spaceId,
      args.featureKey,
    );
    // A disabled metered feature admits no usage at all.
    const quota = effective.enabled ? effective.quota : 0;
    if (quota === null) {
      return;
    }

    const used = await this.getUsed({ entityManager, effective, now });
    if (used + args.increment > quota) {
      throw new QuotaExceededError({
        feature: args.featureKey,
        quota,
        used,
        resetsAt: this.resetsAtFor({
          feature: effective.feature,
          space: effective.space,
          activeSubscription: effective.activeSubscription,
          now,
        }),
      });
    }
  }

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

    return await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        const now = new Date();
        const effective = await this.getEffectiveEntitlement(
          entityManager,
          args.spaceId,
          args.featureKey,
        );
        if (effective.feature.type !== 'metered') {
          throw new Error(`${args.featureKey} is not a metered feature`);
        }
        const quota = effective.enabled ? effective.quota : 0;
        const resetsAt = this.resetsAtFor({
          feature: effective.feature,
          space: effective.space,
          activeSubscription: effective.activeSubscription,
          now,
        });
        const periodStart = this.eventPeriodStartFor({
          feature: effective.feature,
          space: effective.space,
          activeSubscription: effective.activeSubscription,
          now,
        });

        // Ensure the period row exists, then increment it atomically with the
        // quota guard in the same statement — no read-modify-write race.
        await entityManager.query(
          `INSERT INTO space_feature_usage ("space_id", "feature_id", "period_start", "used")
           VALUES ($1, $2, $3, 0)
           ON CONFLICT ON CONSTRAINT "UQ_SFU_space_feature_period" DO NOTHING`,
          [args.spaceId, effective.feature.id, periodStart],
        );
        // TypeORM returns UPDATE ... RETURNING results as [rows, rowCount].
        const [rows]: [Array<{ used: number }>, number] =
          await entityManager.query(
            `UPDATE space_feature_usage
             SET "used" = "used" + $4, "updated_at" = CURRENT_TIMESTAMP
             WHERE "space_id" = $1 AND "feature_id" = $2 AND "period_start" = $3
               AND ($5::integer IS NULL OR "used" + $4 <= $5)
             RETURNING "used"`,
            [args.spaceId, effective.feature.id, periodStart, amount, quota],
          );

        if (rows.length === 0) {
          const used = await this.getUsed({ entityManager, effective, now });
          throw new QuotaExceededError({
            feature: args.featureKey,
            quota: quota as number,
            used,
            resetsAt,
          });
        }

        return { used: rows[0].used, quota };
      },
    );
  }

  public async materialize(args: {
    spaceId: Space['id'];
    subscriptions: Array<MaterializedSubscription>;
  }): Promise<void> {
    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await this.findSpaceOrFail(entityManager, args.spaceId);

      const features = await entityManager.find(Feature);
      const featureIdByKey = new Map(
        features.map((feature) => [feature.key, feature.id]),
      );

      // Demotions (e.g. active → canceled) run before promotions/inserts so
      // the "one active subscription per space" partial unique index never
      // sees both the outgoing and the incoming subscription active at once.
      const ordered = [...args.subscriptions].sort(
        (a, b) =>
          Number(isActiveSubscriptionStatus(a.status)) -
          Number(isActiveSubscriptionStatus(b.status)),
      );

      let activeRowId: number | null = null;
      let activePackage: MaterializedSubscription['entitlements'] = null;

      for (const subscription of ordered) {
        const values = {
          status: subscription.status,
          planId: subscription.planId,
          planName: subscription.planName,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
        };
        const existing = await entityManager.findOne(SpaceSubscription, {
          where: {
            upstreamSubscriptionId: subscription.upstreamSubscriptionId,
          },
          select: { id: true },
        });

        let rowId: number;
        if (existing) {
          await entityManager.update(SpaceSubscription, existing.id, values);
          rowId = existing.id;
        } else {
          const inserted = await entityManager.insert(SpaceSubscription, {
            ...values,
            upstreamSubscriptionId: subscription.upstreamSubscriptionId,
            space: { id: args.spaceId },
          });
          rowId = inserted.identifiers[0].id as number;
        }

        if (subscription.entitlements !== null) {
          activeRowId = rowId;
          activePackage = subscription.entitlements;
        }
      }

      if (activeRowId !== null && activePackage !== null) {
        // Full replace: reprocessing the same upstream state yields the same
        // rows (idempotent by construction).
        await entityManager.query(
          `DELETE FROM subscription_entitlements WHERE "subscription_id" = $1`,
          [activeRowId],
        );
        if (activePackage.length > 0) {
          await entityManager.insert(
            SubscriptionEntitlement,
            activePackage.flatMap((entitlement) => {
              const featureId = featureIdByKey.get(entitlement.featureKey);
              // Unknown keys are dropped by the parser; guard anyway.
              if (featureId === undefined) {
                return [];
              }
              return [
                {
                  subscription: { id: activeRowId as number },
                  feature: { id: featureId },
                  enabled: entitlement.enabled,
                  quota: entitlement.quota,
                  value: entitlement.value,
                },
              ];
            }),
          );
        }
      }
    });
  }

  public async replaceSeatSelection(args: {
    spaceId: Space['id'];
    spaceSafeIds: Array<number>;
  }): Promise<void> {
    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.query(
        `DELETE FROM space_seat_selection WHERE "space_id" = $1`,
        [args.spaceId],
      );
      if (args.spaceSafeIds.length > 0) {
        await entityManager.insert(
          SpaceSeatSelection,
          args.spaceSafeIds.map((spaceSafeId) => ({
            space: { id: args.spaceId },
            spaceSafe: { id: spaceSafeId },
          })),
        );
      }
    });
  }

  private async getManager(
    entityManager?: EntityManager,
  ): Promise<EntityManager> {
    if (entityManager) {
      return entityManager;
    }
    const dataSource =
      await this.postgresDatabaseService.initializeDatabaseConnection();
    return dataSource.manager;
  }

  private async findSpaceOrFail(
    entityManager: EntityManager,
    spaceId: Space['id'],
  ): Promise<Pick<Space, 'id' | 'createdAt'>> {
    const space = await entityManager.findOne(Space, {
      where: { id: spaceId },
      select: { id: true, createdAt: true },
    });
    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }
    return space;
  }

  private async findActiveSubscription(
    entityManager: EntityManager,
    spaceId: Space['id'],
  ): Promise<SpaceSubscription | null> {
    return await entityManager.findOne(SpaceSubscription, {
      where: {
        space: { id: spaceId },
        status: In([...ACTIVE_SUBSCRIPTION_STATUSES]),
      },
      relations: { entitlements: { feature: true } },
    });
  }

  private async getEffectiveEntitlement(
    entityManager: EntityManager,
    spaceId: Space['id'],
    featureKey: FeatureKey,
  ): Promise<EffectiveEntitlement> {
    const space = await this.findSpaceOrFail(entityManager, spaceId);
    const feature = await entityManager.findOne(Feature, {
      where: { key: featureKey },
    });
    if (!feature) {
      throw new Error(`Feature ${featureKey} is missing from the catalog`);
    }
    const activeSubscription = await this.findActiveSubscription(
      entityManager,
      spaceId,
    );
    const row = activeSubscription?.entitlements?.find(
      (entitlement) => entitlement.feature.id === feature.id,
    );

    return {
      space,
      feature,
      activeSubscription,
      enabled: row ? row.enabled : feature.freeEnabled,
      quota: row ? row.quota : feature.freeQuota,
      value: row ? row.value : feature.freeValue,
    };
  }

  private async getUsed(args: {
    entityManager: EntityManager;
    effective: EffectiveEntitlement;
    now: Date;
  }): Promise<number> {
    const { entityManager, effective, now } = args;
    const spaceId = effective.space.id;

    if (effective.feature.key === 'safe_seats') {
      return await entityManager.count(SpaceSafe, {
        where: { space: { id: spaceId } },
      });
    }
    if (effective.feature.key === 'members') {
      return await entityManager.count(Member, {
        where: activeOrPendingMemberWhere<Member>(() => ({
          space: { id: spaceId },
        })),
      });
    }

    const usage = await entityManager.findOne(SpaceFeatureUsage, {
      where: {
        space: { id: spaceId },
        feature: { id: effective.feature.id },
        periodStart: this.eventPeriodStartFor({
          feature: effective.feature,
          space: effective.space,
          activeSubscription: effective.activeSubscription,
          now,
        }),
      },
    });
    return usage?.used ?? 0;
  }

  private async getEventUsage(args: {
    entityManager: EntityManager;
    space: Pick<Space, 'id' | 'createdAt'>;
    features: Array<Feature>;
    activeSubscription: SpaceSubscription | null;
    now: Date;
  }): Promise<Map<number, number>> {
    const eventMetered = args.features.filter(
      (feature) =>
        feature.type === 'metered' && !isStockMeteredFeature(feature.key),
    );
    if (eventMetered.length === 0) {
      return new Map();
    }

    const rows = await args.entityManager.find(SpaceFeatureUsage, {
      where: eventMetered.map((feature) => ({
        space: { id: args.space.id },
        feature: { id: feature.id },
        periodStart: this.eventPeriodStartFor({
          feature,
          space: args.space,
          activeSubscription: args.activeSubscription,
          now: args.now,
        }),
      })),
      relations: { feature: true },
    });
    return new Map(
      rows.flatMap((row) =>
        row.feature ? [[row.feature.id, row.used] as const] : [],
      ),
    );
  }

  /**
   * The current usage-period start of an event-metered feature.
   *
   * Paid workspaces anchor on the billing cycle; free ones bucket usage in
   * `free_period`-day windows anchored at the workspace's creation date
   * (`period_start = created_at + floor((now - created_at) / period) * period`).
   * Without any window the whole lifetime is a single bucket.
   */
  private eventPeriodStartFor(args: {
    feature: Feature;
    space: Pick<Space, 'id' | 'createdAt'>;
    activeSubscription: SpaceSubscription | null;
    now: Date;
  }): Date {
    if (args.activeSubscription?.currentPeriodStart) {
      return args.activeSubscription.currentPeriodStart;
    }
    if (args.feature.freePeriod !== null) {
      const anchor = args.space.createdAt.getTime();
      const periodMs = args.feature.freePeriod * DAY_IN_MS;
      const elapsed = Math.max(0, args.now.getTime() - anchor);
      return new Date(anchor + Math.floor(elapsed / periodMs) * periodMs);
    }
    return args.space.createdAt;
  }

  private resetsAtFor(args: {
    feature: Feature;
    space: Pick<Space, 'id' | 'createdAt'>;
    activeSubscription: SpaceSubscription | null;
    now: Date;
  }): Date | null {
    if (isStockMeteredFeature(args.feature.key)) {
      return null;
    }
    if (args.activeSubscription?.currentPeriodStart) {
      return args.activeSubscription.currentPeriodEnd;
    }
    if (args.feature.freePeriod !== null) {
      const periodStart = this.eventPeriodStartFor(args);
      return new Date(
        periodStart.getTime() + args.feature.freePeriod * DAY_IN_MS,
      );
    }
    return null;
  }

  /**
   * The Safes losing the org layer when over-seat. Covered seats default to
   * the oldest Safes (deterministic, computed at read); an admin-stored
   * selection takes precedence and is topped up oldest-first when it covers
   * fewer Safes than the quota allows.
   */
  private async computeOverSeatSafeIds(
    entityManager: EntityManager,
    spaceId: Space['id'],
    quota: number,
  ): Promise<Array<number>> {
    const safes = await entityManager.find(SpaceSafe, {
      select: { id: true },
      where: { space: { id: spaceId } },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const safeIds = safes.map((safe) => safe.id);

    const selections = await entityManager.find(SpaceSeatSelection, {
      where: { space: { id: spaceId } },
      relations: { spaceSafe: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const currentIds = new Set(safeIds);
    const selectedIds = selections
      .flatMap((selection) =>
        selection.spaceSafe ? [selection.spaceSafe.id] : [],
      )
      .filter((id) => currentIds.has(id));

    const covered = new Set(selectedIds.slice(0, quota));
    for (const id of safeIds) {
      if (covered.size >= quota) {
        break;
      }
      covered.add(id);
    }
    return safeIds.filter((id) => !covered.has(id));
  }
}
