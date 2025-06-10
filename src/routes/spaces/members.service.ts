import { ConflictException, Inject } from '@nestjs/common';
import { IMembersRepository } from '@/domain/users/members.repository.interface';
import { User } from '@/domain/users/entities/user.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Space } from '@/domain/spaces/entities/space.entity';
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
      this.configurationService.getOrThrow<number>('spaces.maxInvites');
  }

  public async inviteUser(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    inviteUsersDto: InviteUsersDto;
  }): Promise<Array<Invitation>> {
    if (args.inviteUsersDto.users.length > this.maxInvites) {
      throw new ConflictException('Too many invites.');
    }
    return await this.membersRepository.inviteUsers({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
      users: args.inviteUsersDto.users,
    });
  }

  public async acceptInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    acceptInviteDto: AcceptInviteDto;
  }): Promise<void> {
    return await this.membersRepository.acceptInvite({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
      payload: args.acceptInviteDto,
    });
  }

  public async declineInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void> {
    return await this.membersRepository.declineInvite({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
    });
  }

  public async get(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<MembersDto> {
    return {
      members: await this.membersRepository.findAuthorizedMembersOrFail({
        authPayload: args.authPayload,
        spaceId: args.spaceId,
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
      spaceId: args.spaceId,
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
      spaceId: args.spaceId,
    });
  }

  public async selfRemove(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void> {
    return await this.membersRepository.removeSelf({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
    });
  }
}
