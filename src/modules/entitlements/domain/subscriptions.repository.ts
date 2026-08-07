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

  public async getSubscriptionByUpstreamId(
    upstreamSubscriptionId: string,
    entityManager?: EntityManager,
  ): Promise<Pick<SpaceSubscription, 'id'> | null> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceSubscription,
      entityManager,
    );
    return await repository.findOne({
      where: { upstreamSubscriptionId },
      select: { id: true },
    });
  }

  public async createSubscription(
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
    const inserted = await repository.insert({
      ...args.values,
      upstreamSubscriptionId: args.upstreamSubscriptionId,
      space: { id: args.spaceId },
    });
    return inserted.identifiers[0].id as number;
  }

  public async updateSubscription(
    args: { id: number; values: SubscriptionValues },
    entityManager?: EntityManager,
  ): Promise<void> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceSubscription,
      entityManager,
    );
    await repository.update(args.id, args.values);
  }
}
