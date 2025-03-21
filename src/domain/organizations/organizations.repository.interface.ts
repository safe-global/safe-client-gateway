import type { OrganizationsRepository } from '@/domain/organizations/organizations.repository';
import type { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import type {
  FindOptionsWhere,
  FindOptionsSelect,
  FindOptionsRelations,
} from 'typeorm';
import type { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';

export const IOrganizationsRepository = Symbol('IOrganizationsRepository');

export interface IOrganizationsRepository {
  create(args: {
    userId: User['id'];
    name: string;
    status: keyof typeof OrganizationStatus;
  }): Promise<Pick<Organization, 'id' | 'name'>>;

  findOneOrFail(
    args: Parameters<OrganizationsRepository['findOne']>[0],
  ): Promise<Organization>;

  findOne(args: {
    where:
      | Array<FindOptionsWhere<Organization>>
      | FindOptionsWhere<Organization>;
    select?: FindOptionsSelect<Organization>;
    relations?: FindOptionsRelations<Organization>;
  }): Promise<Organization | null>;

  findOrFail(
    args: Parameters<OrganizationsRepository['find']>[0],
  ): Promise<Array<Organization>>;

  find(args: {
    where:
      | Array<FindOptionsWhere<Organization>>
      | FindOptionsWhere<Organization>;
    select?: FindOptionsSelect<Organization>;
    relations?: FindOptionsRelations<Organization>;
  }): Promise<Array<Organization>>;

  findOneByUserId(args: {
    userId: User['id'];
    select?: FindOptionsSelect<Organization>;
    relations?: FindOptionsRelations<Organization>;
  }): Promise<Organization | null>;

  update(args: {
    id: Organization['id'];
    updatePayload: Partial<Pick<Organization, 'name' | 'status'>>;
  }): Promise<Pick<Organization, 'id'>>;

  delete(id: number): Promise<void>;
}
