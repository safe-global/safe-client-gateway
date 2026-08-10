// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { getScopedRepository } from '@/datasources/db/v2/get-scoped-repository.util';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
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
}
