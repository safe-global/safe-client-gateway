// SPDX-License-Identifier: FSL-1.1-MIT
import { ConflictException, ForbiddenException, Inject } from '@nestjs/common';
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
import type { UpdateMemberAliasDto } from '@/modules/spaces/routes/entities/update-member-name.dto.entity';
import type { UpdateRoleDto } from '@/modules/spaces/routes/entities/update-role.dto.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';

export class MembersService {
  private readonly maxInvites: number;
  private readonly inviteTtlMs: number;

  public constructor(
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxInvites =
      this.configurationService.getOrThrow<number>('spaces.maxInvites');
    this.inviteTtlMs = this.configurationService.getOrThrow<number>(
      'spaces.invite.ttlMs',
    );
  }

  public async inviteUser(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    inviteUsersDto: InviteUsersDto;
  }): Promise<Array<Invitation>> {
    await this.assertActiveAdmin({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
    });
    if (args.inviteUsersDto.users.length > this.maxInvites) {
      throw new ConflictException('Too many invites.');
    }
    return await this.membersRepository.inviteUsers({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
      users: args.inviteUsersDto.users,
      inviteExpiresAt: new Date(Date.now() + this.inviteTtlMs),
    });
  }

  public async renewInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    userId: User['id'];
  }): Promise<Invitation> {
    await this.assertActiveAdmin({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
    });
    return await this.membersRepository.renewInvite({
      spaceId: args.spaceId,
      userId: args.userId,
      inviteExpiresAt: new Date(Date.now() + this.inviteTtlMs),
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
    const [members, activeAdmin] = await Promise.all([
      this.membersRepository.findAuthorizedMembersOrFail({
        authPayload: args.authPayload,
        spaceId: args.spaceId,
      }),
      this.membersRepository.findActiveAdmin({
        userId: getAuthenticatedUserIdOrFail(args.authPayload),
        spaceId: args.spaceId,
      }),
    ]);
    const isActiveAdmin = Boolean(activeAdmin);
    return {
      members: members.map((member) => ({
        ...member,
        user: this.toMemberUser(
          member.user,
          // Until the member accepted the invite, only expose their email
          // to active admins.
          member.status === 'ACTIVE' || isActiveAdmin
            ? member.user.email
            : null,
        ),
      })),
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
    return {
      ...member,
      user: this.toMemberUser(member.user, member.user.email),
    };
  }

  /**
   * Maps a domain user to the public shape exposed in member responses,
   * explicitly omitting sensitive fields such as `extUserId`.
   */
  private toMemberUser(user: User, email: User['email']): MemberDto['user'] {
    return {
      id: user.id,
      status: user.status,
      email,
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

  private async assertActiveAdmin(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    const activeAdmin = await this.membersRepository.findActiveAdmin({
      userId,
      spaceId: args.spaceId,
    });
    if (!activeAdmin) {
      throw new ForbiddenException('User is not an active admin.');
    }
  }
}
