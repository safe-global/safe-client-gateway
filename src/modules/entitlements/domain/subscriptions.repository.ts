// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type EntityManager, In, type Repository } from 'typeorm';
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

  public async getActiveSubscriptionBySpaceId(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<SpaceSubscription | null> {
    const repository = await this.getRepository(entityManager);
    return await repository.findOne({
      where: {
        space: { id: spaceId },
        status: In([...ACTIVE_SUBSCRIPTION_STATUSES]),
      },
      relations: { entitlements: { feature: true } },
    });
  }

  public async countSubscriptionsBySpaceId(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<number> {
    const repository = await this.getRepository(entityManager);
    return await repository.count({
      where: { space: { id: spaceId } },
    });
  }

  public async getSubscriptionByUpstreamId(
    upstreamSubscriptionId: string,
    entityManager?: EntityManager,
  ): Promise<Pick<SpaceSubscription, 'id'> | null> {
    const repository = await this.getRepository(entityManager);
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
    const repository = await this.getRepository(entityManager);
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
    const repository = await this.getRepository(entityManager);
    await repository.update(args.id, args.values);
  }

  /** Bound to the caller's transaction when one is passed. */
  private async getRepository(
    entityManager?: EntityManager,
  ): Promise<Repository<SpaceSubscription>> {
    return entityManager
      ? entityManager.getRepository(SpaceSubscription)
      : await this.postgresDatabaseService.getRepository(SpaceSubscription);
  }
}
