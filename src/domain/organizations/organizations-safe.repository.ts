import { Inject, NotFoundException } from '@nestjs/common';
import { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import type { IOrganizationSafesRepository } from '@/domain/organizations/organizations-safe.repository.interface';
import {
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';

export class OrganizationSafesRepository
  implements IOrganizationSafesRepository
{
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async create(args: {
    organizationId: Organization['id'];
    payload: Array<{
      chainId: OrganizationSafe['chainId'];
      address: OrganizationSafe['address'];
    }>;
  }): Promise<void> {
    const organizationSafeRepository =
      await this.postgresDatabaseService.getRepository(OrganizationSafe);

    const safesToInsert = args.payload.map((safe) => ({
      organization: {
        id: args.organizationId,
      },
      chainId: safe.chainId,
      address: safe.address,
    }));

    try {
      await organizationSafeRepository.insert(safesToInsert);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new UniqueConstraintError(
          `An OrganizationSafe with the same chainId and address already exists: ${err.driverError.detail}`,
        );
      }
      throw err;
    }
  }

  public async findByOrganizationId(
    organizationId: Organization['id'],
  ): Promise<Array<Pick<OrganizationSafe, 'chainId' | 'address'>>> {
    const organizationSafeRepository =
      await this.postgresDatabaseService.getRepository(OrganizationSafe);

    return await organizationSafeRepository.find({
      select: { chainId: true, address: true },
      where: {
        organization: {
          id: organizationId,
        },
      },
    });
  }

  public async findOrFail(
    args: Parameters<OrganizationSafesRepository['find']>[0],
  ): Promise<Array<OrganizationSafe>> {
    const organizationSafes = await this.find(args);

    if (organizationSafes.length === 0) {
      throw new NotFoundException('Organization has no Safes.');
    }

    return organizationSafes;
  }

  public async find(args: {
    where:
      | Array<FindOptionsWhere<OrganizationSafe>>
      | FindOptionsWhere<OrganizationSafe>;
    select?: FindOptionsSelect<OrganizationSafe>;
    relations?: FindOptionsRelations<OrganizationSafe>;
  }): Promise<Array<OrganizationSafe>> {
    const organizationSafeRepository =
      await this.postgresDatabaseService.getRepository(OrganizationSafe);

    return await organizationSafeRepository.find(args);
  }

  public async delete(args: {
    organizationId: Organization['id'];
    payload: Array<{
      chainId: OrganizationSafe['chainId'];
      address: OrganizationSafe['address'];
    }>;
  }): Promise<void> {
    const organizationSafeRepository =
      await this.postgresDatabaseService.getRepository(OrganizationSafe);

    const findOrganizationSafesWhereClause: Array<
      FindOptionsWhere<OrganizationSafe>
    > = args.payload.map((safe) => {
      return {
        organization: {
          id: args.organizationId,
        },
        chainId: safe.chainId,
        address: safe.address,
      };
    });

    const organizationSafes = await this.findOrFail({
      where: findOrganizationSafesWhereClause,
    });

    await organizationSafeRepository.remove(organizationSafes);
  }
}
