// SPDX-License-Identifier: FSL-1.1-MIT
import { ConflictException, Inject } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { AcceptInviteDto } from '@/modules/spaces/routes/entities/accept-invite.dto.entity';
import type { Invitation } from '@/modules/spaces/routes/entities/invitation.entity';
import type { InviteUsersDto } from '@/modules/spaces/routes/entities/invite-users.dto.entity';
import type {
  MemberDto,
  MembersDto,
} from '@/modules/spaces/routes/entities/members.dto.entity';
import type { ResendInviteDto } from '@/modules/spaces/routes/entities/resend-invite.dto.entity';
import type { UpdateMemberAliasDto } from '@/modules/spaces/routes/entities/update-member-name.dto.entity';
import type { UpdateRoleDto } from '@/modules/spaces/routes/entities/update-role.dto.entity';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';

export class MembersService {
  private readonly maxInvites: number;
  private readonly inviteExpirySeconds: number;

  public constructor(
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxInvites =
      this.configurationService.getOrThrow<number>('spaces.maxInvites');
    this.inviteExpirySeconds = this.configurationService.getOrThrow<number>(
      'spaces.inviteExpirySeconds',
    );
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
      inviteExpiresAt: this.getInviteExpiresAt(),
      users: args.inviteUsersDto.users,
    });
  }

  public async resendInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    resendInviteDto: ResendInviteDto;
  }): Promise<void> {
    return await this.membersRepository.resendInvite({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
      address: args.resendInviteDto.address,
      email: args.resendInviteDto.email,
      inviteExpiresAt: this.getInviteExpiresAt(),
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
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    const members = await this.membersRepository.findAuthorizedMembersOrFail({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
    });
    const isAdmin = members.some((member) => {
      return (
        member.user.id === userId &&
        member.status === 'ACTIVE' &&
        member.role === 'ADMIN'
      );
    });

    return {
      members: members
        .filter((member) => isAdmin || member.status === 'ACTIVE')
        .map((member) =>
          this.toMemberDto(member, { includeInvitedEmail: isAdmin }),
        ),
    };
  }

  public async getSelfMembership(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<MemberDto> {
    const member = await this.membersRepository.findSelfMembershipOrFail({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
    });

    // Self-view can expose the caller's own invited email.
    return member;
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

  public async updateAlias(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    updateMemberAliasDto: UpdateMemberAliasDto;
  }): Promise<void> {
    await this.membersRepository.updateAlias({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
      alias: args.updateMemberAliasDto.alias,
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

  private toMemberDto(
    member: Member,
    options: { includeInvitedEmail?: boolean } = {},
  ): MemberDto {
    return {
      ...member,
      user: {
        ...member.user,
        email:
          member.status === 'ACTIVE' || options.includeInvitedEmail === true
            ? member.user.email
            : null,
      },
    };
  }

  private getInviteExpiresAt(): Date {
    return new Date(Date.now() + this.inviteExpirySeconds * 1_000);
  }
}
