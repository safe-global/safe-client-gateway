import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import type { ISpaceSafesRepository } from '@/domain/spaces/space-safes.repository.interface';
import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import {
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';

export class SpaceSafesRepository implements ISpaceSafesRepository {
  private readonly maxSafesPerSpace: number;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxSafesPerSpace = this.configurationService.getOrThrow<number>(
      'spaces.maxSafesPerSpace',
    );
  }

  public async create(args: {
    spaceId: Space['id'];
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
  }): Promise<void> {
    const spaceSafeRepository =
      await this.postgresDatabaseService.getRepository(SpaceSafe);

    const safesToInsert = args.payload.map((safe) => ({
      space: { id: args.spaceId },
      chainId: safe.chainId,
      address: safe.address,
    }));

    const existingSafes = await this.findBySpaceId(args.spaceId);
    if (existingSafes.length + safesToInsert.length > this.maxSafesPerSpace) {
      throw new BadRequestException(
        `This Space only allows a maximum of ${this.maxSafesPerSpace} Safe Accounts. You can only add up to ${this.maxSafesPerSpace - existingSafes.length} more.`,
      );
    }

    try {
      await spaceSafeRepository.insert(safesToInsert);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new UniqueConstraintError(
          `A SpaceSafe with the same chainId and address already exists: ${err.driverError.detail}`,
        );
      }
      throw err;
    }
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
      throw new NotFoundException('Space has no Safes.');
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
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
  }): Promise<void> {
    const spaceSafeRepository =
      await this.postgresDatabaseService.getRepository(SpaceSafe);

    const findSpaceSafesWhereClause: Array<FindOptionsWhere<SpaceSafe>> =
      args.payload.map((safe) => {
        return {
          space: { id: args.spaceId },
          chainId: safe.chainId,
          address: safe.address,
        };
      });

    const spaceSafes = await this.findOrFail({
      where: findSpaceSafesWhereClause,
    });

    await spaceSafeRepository.remove(spaceSafes);
  }
}
