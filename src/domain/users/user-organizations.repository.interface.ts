import type { UserOrganization as DbUserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';
import type { User } from '@/domain/users/entities/user.entity';
import type { FindOptionsWhere, FindOptionsRelations } from 'typeorm';

export const IUsersOrganizationsRepository = Symbol(
  'IUsersOrganizationsRepository',
);

export interface IUsersOrganizationsRepository {
  // TODO: Create factory for base "finders"
  findOneOrFail(
    where:
      | Array<FindOptionsWhere<UserOrganization>>
      | FindOptionsWhere<UserOrganization>,
    relations?: FindOptionsRelations<UserOrganization>,
  ): Promise<DbUserOrganization>;

  findOne(
    where:
      | Array<FindOptionsWhere<UserOrganization>>
      | FindOptionsWhere<UserOrganization>,
    relations?: FindOptionsRelations<UserOrganization>,
  ): Promise<DbUserOrganization | null>;

  inviteUser(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    walletAddress: `0x${string}`;
    role: UserOrganization['role'];
  }): Promise<
    Pick<UserOrganization, 'role' | 'status'> & {
      userId: User['id'];
      orgId: Organization['id'];
    }
  >;

  updateStatus(args: {
    authPayload: AuthPayload;
    _orgId: Organization['id'];
    userOrgId: UserOrganization['id'];
    status: UserOrganization['status'];
  }): Promise<void>;

  get(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<Array<UserOrganization>>;

  updateRole(args: {
    authPayload: AuthPayload;
    _orgId: Organization['id'];
    userOrgId: UserOrganization['id'];
    role: UserOrganization['role'];
  }): Promise<void>;

  removeUser(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userOrgId: UserOrganization['id'];
  }): Promise<void>;
}
