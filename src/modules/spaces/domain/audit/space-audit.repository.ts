// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  And,
  type EntityManager,
  type FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { SpaceAuditLog } from '@/modules/spaces/datasources/entities/space-audit-log.entity.db';
import { SpaceAuditEventSchema } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import type {
  ISpaceAuditRepository,
  SpaceAuditFindArgs,
  SpaceAuditRecordArgs,
} from '@/modules/spaces/domain/audit/space-audit.repository.interface';

@Injectable()
export class SpaceAuditRepository implements ISpaceAuditRepository {
  private readonly isEnabled: boolean;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isEnabled = this.configurationService.getOrThrow<boolean>(
      'features.spaceAuditLog',
    );
  }

  public async record(
    entityManager: EntityManager,
    args: SpaceAuditRecordArgs,
  ): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    // Parsing strips unknown payload fields at the write boundary.
    const event = SpaceAuditEventSchema.parse({
      eventType: args.eventType,
      payload: args.payload,
    });

    await entityManager.insert(SpaceAuditLog, {
      spaceId: args.spaceId,
      spaceUuid: args.spaceUuid,
      eventType: event.eventType,
      actorUserId: args.actorUserId,
      payload: event.payload,
    });
  }

  public async findBySpaceId(
    args: SpaceAuditFindArgs,
  ): Promise<[Array<SpaceAuditLog>, number]> {
    const repository =
      await this.postgresDatabaseService.getRepository(SpaceAuditLog);

    const createdAtBounds = [
      ...(args.createdAtGte ? [MoreThanOrEqual(args.createdAtGte)] : []),
      ...(args.createdAtLte ? [LessThanOrEqual(args.createdAtLte)] : []),
    ];
    const where: FindOptionsWhere<SpaceAuditLog> = {
      spaceId: args.spaceId,
      ...(args.eventTypes &&
        args.eventTypes.length > 0 && { eventType: In(args.eventTypes) }),
      ...(args.actorUserId !== undefined && {
        actorUserId: args.actorUserId,
      }),
      ...(createdAtBounds.length > 0 && { createdAt: And(...createdAtBounds) }),
    };

    // Same-transaction events share created_at — tie-break on id.
    const direction = args.sortDirection === 'asc' ? 'ASC' : 'DESC';

    return await repository.findAndCount({
      where,
      order: { createdAt: direction, id: direction },
      take: args.limit,
      skip: args.offset,
    });
  }

  public async findDistinctActorIds(spaceId: number): Promise<Array<number>> {
    const repository =
      await this.postgresDatabaseService.getRepository(SpaceAuditLog);

    const rows = await repository
      .createQueryBuilder('sal')
      .select('sal.actor_user_id', 'actorUserId')
      .distinct(true)
      .where('sal.space_id = :spaceId', { spaceId })
      .orderBy('sal.actor_user_id', 'ASC')
      .getRawMany<{ actorUserId: number }>();

    return rows.map((row) => row.actorUserId);
  }
}
