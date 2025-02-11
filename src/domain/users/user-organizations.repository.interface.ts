import type { UserOrganization as DbUserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type {
  UserOrganization,
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';
import type { User } from '@/domain/users/entities/user.entity';
import type { FindOptionsWhere, FindOptionsRelations } from 'typeorm';

export const IUsersOrganizationsRepository = Symbol(
  'IUsersOrganizationsRepository',
);

export interface IUsersOrganizationsRepository {
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

  inviteUsers(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    users: Array<{
      address: `0x${string}`;
      role: keyof typeof UserOrganizationRole;
    }>;
  }): Promise<
    Array<{
      userId: User['id'];
      orgId: Organization['id'];
      role: keyof typeof UserOrganizationRole;
      status: keyof typeof UserOrganizationStatus;
    }>
  >;

  acceptInvite(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<void>;

  declineInvite(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<void>;

  get(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<Array<UserOrganization>>;

  updateRole(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userId: User['id'];
    role: UserOrganization['role'];
  }): Promise<void>;

  removeUser(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userId: User['id'];
  }): Promise<void>;
}
