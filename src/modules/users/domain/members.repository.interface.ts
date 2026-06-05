// SPDX-License-Identifier: FSL-1.1-MIT

import type {
  FindManyOptions,
  FindOptionsRelations,
  FindOptionsWhere,
} from 'typeorm';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { InviteUserInput } from '@/modules/spaces/routes/entities/invite-users.dto.entity';
import type { Member as DbMember } from '@/modules/users/datasources/entities/member.entity.db';
import type { Invitation } from '@/modules/users/domain/entities/invitation.entity';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

export const IMembersRepository = Symbol('IMembersRepository');

export interface IMembersRepository {
  findOneOrFail(
    where: Array<FindOptionsWhere<Member>> | FindOptionsWhere<Member>,
    relations?: FindOptionsRelations<Member>,
  ): Promise<DbMember>;

  findOne(
    where: Array<FindOptionsWhere<Member>> | FindOptionsWhere<Member>,
    relations?: FindOptionsRelations<Member>,
  ): Promise<DbMember | null>;

  findOrFail(
    args?: FindManyOptions<DbMember>,
  ): Promise<[DbMember, ...Array<DbMember>]>;

  find(args?: FindManyOptions<DbMember>): Promise<Array<DbMember>>;

  findActiveAdmin(args: {
    userId: User['id'];
    spaceId: Space['id'];
  }): Promise<DbMember | null>;

  /**
   * Invites users to a space until the provided expiry date.
   * Existing invited members are renewed: the stored invite data is
   * overwritten with the new invite, including a refreshed expiry. This
   * doubles as resending a (lapsed) invite.
   * Active and declined members cannot be (re-)invited.
   */
  inviteUsers(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    users: Array<InviteUserInput>;
    inviteExpiresAt: Date;
  }): Promise<Array<Invitation>>;

  /**
   * Renews a pending space invitation, refreshing its expiry.
   * Only invitations in the `INVITED` state can be renewed; the original
   * `invitedBy`, `name` and `role` are preserved. Active or declined
   * members cannot be renewed.
   */
  renewInvite(args: {
    spaceId: Space['id'];
    userId: User['id'];
    inviteExpiresAt: Date;
  }): Promise<Invitation>;

  /**
   * Accepts a pending space invite for the authenticated user.
   * Expired invites cannot be accepted.
   */
  acceptInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    payload: Pick<Member, 'name'>;
  }): Promise<void>;

  /**
   * Declines a pending space invite for the authenticated user.
   * Expired invites cannot be declined.
   */
  declineInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void>;

  findAuthorizedMembersOrFail(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Array<Member>>;

  findSelfMembershipOrFail(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Member>;

  updateRole(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    userId: User['id'];
    role: Member['role'];
  }): Promise<void>;

  updateAlias(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    alias: Member['alias'];
  }): Promise<void>;

  removeUser(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    userId: User['id'];
  }): Promise<void>;

  removeSelf(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void>;
}
