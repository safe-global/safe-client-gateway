// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import type {
  EntityManager,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';

export class SpaceSafesRepository implements ISpaceSafesRepository {
  private readonly maxSafesPerSpace: number;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
  ) {
    this.maxSafesPerSpace = this.configurationService.getOrThrow<number>(
      'spaces.maxSafesPerSpace',
    );
  }

  private async findSpaceForAuditOrFail(
    entityManager: EntityManager,
    spaceId: Space['id'],
  ): Promise<Pick<Space, 'id' | 'uuid'>> {
    const space = await entityManager.findOne(Space, {
      where: { id: spaceId },
      select: { id: true, uuid: true },
    });
    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }
    return space;
  }

  public async create(args: {
    spaceId: Space['id'];
    actorUserId: number;
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
  }): Promise<void> {
    const safesToInsert = args.payload.map((safe) => ({
      space: { id: args.spaceId },
      chainId: safe.chainId,
      address: safe.address,
    }));

    const existingSafes = await this.findBySpaceId(args.spaceId);
    if (existingSafes.length + safesToInsert.length > this.maxSafesPerSpace) {
      const remaining = this.maxSafesPerSpace - existingSafes.length;
      throw new BadRequestException(
        remaining > 0
          ? `This Workspace only allows a maximum of ${this.maxSafesPerSpace} Safe Accounts. You can only add up to ${remaining} more.`
          : `This Workspace only allows a maximum of ${this.maxSafesPerSpace} Safe Accounts.`,
      );
    }

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      try {
        await entityManager.insert(SpaceSafe, safesToInsert);
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new UniqueConstraintError(
            `A SpaceSafe with the same chainId and address already exists: ${err.driverError.detail}`,
          );
        }
        throw err;
      }

      const space = await this.findSpaceForAuditOrFail(
        entityManager,
        args.spaceId,
      );
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.SAFE_ADDED,
        actorUserId: args.actorUserId,
        payload: {
          safes: args.payload.map((safe) => ({
            chainId: safe.chainId,
            address: safe.address,
          })),
        },
      });
    });
  }

  public async findBySpaceId(
    spaceId: Space['id'],
  ): Promise<Array<Pick<SpaceSafe, 'chainId' | 'address'>>> {
    const spaceSafeRepository =
      await this.postgresDatabaseService.getRepository(SpaceSafe);

    return await spaceSafeRepository.find({
      select: { chainId: true, address: true },
      where: { space: { id: spaceId } },
    });
  }

  public async findOrFail(
    args: Parameters<SpaceSafesRepository['find']>[0],
  ): Promise<Array<SpaceSafe>> {
    const spaceSafes = await this.find(args);

    if (spaceSafes.length === 0) {
      throw new NotFoundException('Workspace has no Safes.');
    }

    return spaceSafes;
  }

  public async find(args: {
    where: Array<FindOptionsWhere<SpaceSafe>> | FindOptionsWhere<SpaceSafe>;
    select?: FindOptionsSelect<SpaceSafe>;
    relations?: FindOptionsRelations<SpaceSafe>;
  }): Promise<Array<SpaceSafe>> {
    const spaceSafeRepository =
      await this.postgresDatabaseService.getRepository(SpaceSafe);

    return await spaceSafeRepository.find(args);
  }

  public async delete(args: {
    spaceId: Space['id'];
    actorUserId: number;
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
  }): Promise<void> {
    const findSpaceSafesWhereClause: Array<FindOptionsWhere<SpaceSafe>> =
      args.payload.map((safe) => {
        return {
          space: { id: args.spaceId },
          chainId: safe.chainId,
          address: safe.address,
        };
      });

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const spaceSafes = await entityManager.find(SpaceSafe, {
        where: findSpaceSafesWhereClause,
      });
      if (spaceSafes.length === 0) {
        throw new NotFoundException('Workspace has no Safes.');
      }

      await entityManager.remove(spaceSafes);

      const space = await this.findSpaceForAuditOrFail(
        entityManager,
        args.spaceId,
      );
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.SAFE_REMOVED,
        actorUserId: args.actorUserId,
        payload: {
          safes: spaceSafes.map((safe) => ({
            chainId: safe.chainId,
            address: safe.address,
          })),
        },
      });
    });
  }
}
