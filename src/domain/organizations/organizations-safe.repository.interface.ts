import type { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import type { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import type { OrganizationSafesRepository } from '@/domain/organizations/organizations-safe.repository';
import type {
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';

export const IOrganizationSafesRepository = Symbol(
  'IOrganizationSafesRepository',
);

export interface IOrganizationSafesRepository {
  create(args: {
    organizationId: Organization['id'];
    payload: Array<{
      chainId: OrganizationSafe['chainId'];
      address: OrganizationSafe['address'];
    }>;
  }): Promise<void>;

  findByOrganizationId(
    organizationId: Organization['id'],
  ): Promise<Array<Pick<OrganizationSafe, 'chainId' | 'address'>>>;

  findOrFail(
    args: Parameters<OrganizationSafesRepository['find']>[0],
  ): Promise<Array<OrganizationSafe>>;

  find(args: {
    where:
      | Array<FindOptionsWhere<OrganizationSafe>>
      | FindOptionsWhere<OrganizationSafe>;
    select?: FindOptionsSelect<OrganizationSafe>;
    relations?: FindOptionsRelations<OrganizationSafe>;
  }): Promise<Array<OrganizationSafe>>;

  delete(args: {
    organizationId: Organization['id'];
    payload: Array<{
      chainId: OrganizationSafe['chainId'];
      address: OrganizationSafe['address'];
    }>;
  }): Promise<void>;
}
