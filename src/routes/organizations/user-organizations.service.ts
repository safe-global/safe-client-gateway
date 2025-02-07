import { UserOrganizationStatus } from '@/domain/users/entities/user-organization.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { IUsersOrganizationsRepository } from '@/domain/users/user-organizations.repository.interface';
import type { InviteUserDto } from '@/routes/organizations/entities/invite-user.dto.entity';
import type { Invite } from '@/routes/organizations/entities/invite.entity';
import type { Members } from '@/routes/organizations/entities/members.entity';
import type { UpdateRoleDto } from '@/routes/organizations/entities/update-role.dto.entity';

export class UserOrganizationsService {
  public constructor(
    private readonly usersOrgRepository: IUsersOrganizationsRepository,
  ) {}

  public async inviteUser(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    inviteUserDto: InviteUserDto;
  }): Promise<Invite> {
    return await this.usersOrgRepository.inviteUser({
      authPayload: args.authPayload,
      orgId: args.orgId,
      role: args.inviteUserDto.role,
      walletAddress: args.inviteUserDto.walletAddress,
    });
  }

  public async acceptInvite(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userOrgId: UserOrganization['id'];
  }): Promise<void> {
    return await this.usersOrgRepository.updateStatus({
      authPayload: args.authPayload,
      userOrgId: args.userOrgId,
      _orgId: args.orgId,
      status: UserOrganizationStatus.ACTIVE,
    });
  }

  public async declineInvite(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userOrgId: UserOrganization['id'];
  }): Promise<void> {
    return await this.usersOrgRepository.updateStatus({
      authPayload: args.authPayload,
      userOrgId: args.userOrgId,
      _orgId: args.orgId,
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
          role: userOrg.role,
          status: userOrg.status,
          createdAt: userOrg.created_at.toISOString(),
          updatedAt: userOrg.updated_at.toISOString(),
          user: {
            id: userOrg.user.id,
            status: userOrg.user.status,
          },
        };
      }),
    };
  }

  public async updateRole(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userOrgId: UserOrganization['id'];
    updateRoleDto: UpdateRoleDto;
  }): Promise<void> {
    return await this.usersOrgRepository.updateRole({
      authPayload: args.authPayload,
      _orgId: args.orgId,
      userOrgId: args.userOrgId,
      role: args.updateRoleDto.role,
    });
  }

  public async removeUser(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userOrgId: UserOrganization['id'];
  }): Promise<void> {
    return await this.usersOrgRepository.removeUser({
      authPayload: args.authPayload,
      orgId: args.orgId,
      userOrgId: args.userOrgId,
    });
  }
}
