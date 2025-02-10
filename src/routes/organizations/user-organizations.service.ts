import { Inject } from '@nestjs/common';
import { IUsersOrganizationsRepository } from '@/domain/users/user-organizations.repository.interface';
import {
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { User } from '@/domain/users/entities/user.entity';
import { getEnumKey } from '@/domain/common/utils/enums';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { InviteUsersDto } from '@/routes/organizations/entities/invite-users.dto.entity';
import type { Invitation } from '@/routes/organizations/entities/invitation.entity';
import type { Members } from '@/routes/organizations/entities/members.entity';
import type { UpdateRoleDto } from '@/routes/organizations/entities/update-role.dto.entity';

export class UserOrganizationsService {
  public constructor(
    @Inject(IUsersOrganizationsRepository)
    private readonly usersOrgRepository: IUsersOrganizationsRepository,
  ) {}

  public async inviteUser(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    inviteUsersDto: InviteUsersDto;
  }): Promise<Array<Invitation>> {
    return await this.usersOrgRepository.inviteUsers({
      authPayload: args.authPayload,
      orgId: args.orgId,
      users: args.inviteUsersDto,
    });
  }

  public async acceptInvite(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<void> {
    return await this.usersOrgRepository.updateStatus({
      authPayload: args.authPayload,
      orgId: args.orgId,
      status: UserOrganizationStatus.ACTIVE,
    });
  }

  public async declineInvite(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<void> {
    return await this.usersOrgRepository.updateStatus({
      authPayload: args.authPayload,
      orgId: args.orgId,
      status: UserOrganizationStatus.DECLINED,
    });
  }

  public async get(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<Members> {
    const userOrgs = await this.usersOrgRepository.get({
      authPayload: args.authPayload,
      orgId: args.orgId,
    });

    return {
      members: userOrgs.map((userOrg) => {
        return {
          id: userOrg.id,
          role: getEnumKey(UserOrganizationRole, userOrg.role),
          status: getEnumKey(UserOrganizationStatus, userOrg.status),
          createdAt: userOrg.created_at.toISOString(),
          updatedAt: userOrg.updated_at.toISOString(),
          user: {
            id: userOrg.user.id,
            status: getEnumKey(UserStatus, userOrg.user.status),
          },
        };
      }),
    };
  }

  public async updateRole(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userId: User['id'];
    updateRoleDto: UpdateRoleDto;
  }): Promise<void> {
    return await this.usersOrgRepository.updateRole({
      authPayload: args.authPayload,
      orgId: args.orgId,
      userId: args.userId,
      role: args.updateRoleDto.role,
    });
  }

  public async removeUser(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userId: User['id'];
  }): Promise<void> {
    return await this.usersOrgRepository.removeUser({
      authPayload: args.authPayload,
      userId: args.userId,
      orgId: args.orgId,
    });
  }
}
