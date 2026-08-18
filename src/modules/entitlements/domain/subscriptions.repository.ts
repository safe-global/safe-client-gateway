// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { getScopedRepository } from '@/datasources/db/v2/get-scoped-repository.util';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { ACTIVE_SUBSCRIPTION_STATUSES } from '@/modules/entitlements/domain/entitlements.constants';
import type {
  ISubscriptionsRepository,
  SubscriptionValues,
} from '@/modules/entitlements/domain/subscriptions.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

@Injectable()
export class SubscriptionsRepository implements ISubscriptionsRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async upsertSubscription(
    args: {
      spaceId: Space['id'];
      upstreamSubscriptionId: string;
      values: SubscriptionValues;
    },
    entityManager?: EntityManager,
  ): Promise<number> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceSubscription,
      entityManager,
    );
    await repository.upsert(
      {
        ...args.values,
        upstreamSubscriptionId: args.upstreamSubscriptionId,
        space: { id: args.spaceId },
      },
      { conflictPaths: ['upstreamSubscriptionId'] },
    );
    // TypeORM's upsert() return value isn't reliably populated on the
    // conflict (update) path (see notifications.repository.ts for the same
    // workaround) — a follow-up read is the only reliable way to get the id.
    const subscription = await repository.findOneOrFail({
      where: { upstreamSubscriptionId: args.upstreamSubscriptionId },
      select: { id: true },
    });
    return subscription.id;
  }

  public async getLastEventAt(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<Date | null> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceSubscription,
      entityManager,
    );
    // An aggregate rather than an ordered row read: it lets Postgres answer
    // from IDX_subscriptions_space_id_last_event_at with a single seek, so the
    // cost does not grow with the number of subscriptions the space has
    // accumulated. `MAX` ignores unstamped rows, so no NULL handling is needed.
    const newest = await repository
      .createQueryBuilder('subscription')
      .select('MAX(subscription.lastEventAt)', 'lastEventAt')
      .where('space_id = :spaceId', { spaceId })
      .getRawOne<{ lastEventAt: Date | null }>();
    return newest?.lastEventAt ?? null;
  }

  public async lockSpaceForSync(
    spaceId: Space['id'],
    entityManager: EntityManager,
  ): Promise<void> {
    await entityManager.query('SELECT pg_advisory_xact_lock($1)', [spaceId]);
  }

  public async demoteActiveSubscriptions(
    args: {
      spaceId: Space['id'];
      exceptUpstreamSubscriptionId: string;
      lastEventAt: Date | null;
    },
    entityManager?: EntityManager,
  ): Promise<void> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceSubscription,
      entityManager,
    );
    await repository
      .createQueryBuilder()
      .update(SpaceSubscription)
      .set({ status: 'canceled', lastEventAt: args.lastEventAt })
      .where('space_id = :spaceId', { spaceId: args.spaceId })
      .andWhere('status IN (:...activeStatuses)', {
        activeStatuses: [...ACTIVE_SUBSCRIPTION_STATUSES],
      })
      .andWhere('upstream_subscription_id != :exceptUpstreamSubscriptionId', {
        exceptUpstreamSubscriptionId: args.exceptUpstreamSubscriptionId,
      })
      .execute();
  }
}
