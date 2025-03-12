import { ConflictException, Inject } from '@nestjs/common';
import { IUsersOrganizationsRepository } from '@/domain/users/user-organizations.repository.interface';
import { User } from '@/domain/users/entities/user.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { InviteUsersDto } from '@/routes/organizations/entities/invite-users.dto.entity';
import type { Invitation } from '@/routes/organizations/entities/invitation.entity';
import type { UserOrganizationsDto } from '@/routes/organizations/entities/user-organizations.dto.entity';
import type { UpdateRoleDto } from '@/routes/organizations/entities/update-role.dto.entity';
import { AcceptInviteDto } from '@/routes/organizations/entities/accept-invite.dto.entity';

export class UserOrganizationsService {
  private readonly maxInvites: number;
  public constructor(
    @Inject(IUsersOrganizationsRepository)
    private readonly usersOrgRepository: IUsersOrganizationsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxInvites =
      this.configurationService.getOrThrow<number>('users.maxInvites');
  }

  public async inviteUser(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    inviteUsersDto: InviteUsersDto;
  }): Promise<Array<Invitation>> {
    if (args.inviteUsersDto.users.length > this.maxInvites) {
      throw new ConflictException('Too many invites.');
    }

    return await this.usersOrgRepository.inviteUsers({
      authPayload: args.authPayload,
      orgId: args.orgId,
      users: args.inviteUsersDto.users,
    });
  }

  public async acceptInvite(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    acceptInviteDto: AcceptInviteDto;
  }): Promise<void> {
    return await this.usersOrgRepository.acceptInvite({
      authPayload: args.authPayload,
      orgId: args.orgId,
      payload: args.acceptInviteDto,
    });
  }

  public async declineInvite(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<void> {
    return await this.usersOrgRepository.declineInvite(args);
  }

  public async get(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<UserOrganizationsDto> {
    const userOrgs = await this.usersOrgRepository.findAuthorizedUserOrgsOrFail(
      {
        authPayload: args.authPayload,
        orgId: args.orgId,
      },
    );

    return {
      members: userOrgs.map((userOrg) => {
        return {
          id: userOrg.id,
          role: userOrg.role,
          status: userOrg.status,
          name: userOrg.name,
          invitedBy: userOrg.invitedBy,
          createdAt: userOrg.createdAt,
          updatedAt: userOrg.updatedAt,
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
