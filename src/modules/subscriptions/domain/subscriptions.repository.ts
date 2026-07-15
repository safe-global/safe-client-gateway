// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject } from '@nestjs/common';
import type { QueryDeepPartialEntity } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { Subscription } from '@/modules/subscriptions/datasources/entities/subscription.entity.db';
import type { ISubscriptionsRepository } from '@/modules/subscriptions/domain/subscriptions.repository.interface';

export class SubscriptionsRepository implements ISubscriptionsRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  // Idempotent on retries and tolerant of out-of-order delivery: a row is only
  // written if the incoming event is neither a repeat nor older than the last
  // applied one, per the `WHERE` guard below.
  public async upsertFromEvent(args: {
    id: Subscription['id'];
    spaceId: Space['id'];
    status: Subscription['status'];
    metadata: Subscription['metadata'];
    lastEventId: Subscription['lastEventId'];
    lastEventOccurredAt: Subscription['lastEventOccurredAt'];
  }): Promise<void> {
    const repository =
      await this.postgresDatabaseService.getRepository(Subscription);

    await repository
      .createQueryBuilder()
      .insert()
      .into(Subscription)
      .values({
        id: args.id,
        space: { id: args.spaceId },
        status: args.status,
        metadata: args.metadata,
        lastEventId: args.lastEventId,
        lastEventOccurredAt: args.lastEventOccurredAt,
      } as QueryDeepPartialEntity<Subscription>)
      .orUpdate(
        ['status', 'metadata', 'last_event_id', 'last_event_occurred_at'],
        ['id'],
        {
          overwriteCondition: {
            where: `"subscriptions"."last_event_id" IS DISTINCT FROM EXCLUDED."last_event_id"
              AND "subscriptions"."last_event_occurred_at" <= EXCLUDED."last_event_occurred_at"`,
          },
        },
      )
      .execute();
  }

  public async findBySpaceId(
    spaceId: Space['id'],
  ): Promise<Array<Subscription>> {
    const repository =
      await this.postgresDatabaseService.getRepository(Subscription);
    return await repository.find({ where: { space: { id: spaceId } } });
  }

  public async findById(id: Subscription['id']): Promise<Subscription | null> {
    const repository =
      await this.postgresDatabaseService.getRepository(Subscription);
    return await repository.findOne({ where: { id } });
  }
}
