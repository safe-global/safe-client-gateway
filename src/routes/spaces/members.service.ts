import { ConflictException, Inject } from '@nestjs/common';
import { IUsersOrganizationsRepository as IMembersRepository } from '@/domain/users/user-organizations.repository.interface';
import { User } from '@/domain/users/entities/user.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Organization as Space } from '@/domain/organizations/entities/organization.entity';
import type { InviteUsersDto } from '@/routes/spaces/entities/invite-users.dto.entity';
import type { Invitation } from '@/routes/spaces/entities/invitation.entity';
import type { MembersDto } from '@/routes/spaces/entities/members.dto.entity';
import type { UpdateRoleDto } from '@/routes/spaces/entities/update-role.dto.entity';
import { AcceptInviteDto } from '@/routes/spaces/entities/accept-invite.dto.entity';

export class MembersService {
  private readonly maxInvites: number;
  public constructor(
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxInvites =
      this.configurationService.getOrThrow<number>('users.maxInvites');
  }

  public async inviteUser(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    inviteUsersDto: InviteUsersDto;
  }): Promise<Array<Invitation>> {
    if (args.inviteUsersDto.users.length > this.maxInvites) {
      throw new ConflictException('Too many invites.');
    }

    const invitations = await this.membersRepository.inviteUsers({
      authPayload: args.authPayload,
      orgId: args.spaceId,
      users: args.inviteUsersDto.users,
    });

    // TODO: (compatibility) remove this mapping when the Invitation domain entity is updated.
    return invitations.map((invitation) => {
      return {
        userId: invitation.userId,
        name: invitation.name,
        spaceId: invitation.orgId,
        role: invitation.role,
        status: invitation.status,
        invitedBy: invitation.invitedBy,
      };
    });
  }

  public async acceptInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    acceptInviteDto: AcceptInviteDto;
  }): Promise<void> {
    return await this.membersRepository.acceptInvite({
      authPayload: args.authPayload,
      orgId: args.spaceId,
      payload: args.acceptInviteDto,
    });
  }

  public async declineInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void> {
    return await this.membersRepository.declineInvite({
      authPayload: args.authPayload,
      orgId: args.spaceId,
    });
  }

  public async get(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<MembersDto> {
    const userOrgs = await this.membersRepository.findAuthorizedUserOrgsOrFail({
      authPayload: args.authPayload,
      orgId: args.spaceId,
    });

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
    spaceId: Space['id'];
    userId: User['id'];
    updateRoleDto: UpdateRoleDto;
  }): Promise<void> {
    return await this.membersRepository.updateRole({
      authPayload: args.authPayload,
      orgId: args.spaceId,
      userId: args.userId,
      role: args.updateRoleDto.role,
    });
  }

  public async removeUser(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    userId: User['id'];
  }): Promise<void> {
    return await this.membersRepository.removeUser({
      authPayload: args.authPayload,
      userId: args.userId,
      orgId: args.spaceId,
    });
  }
}
