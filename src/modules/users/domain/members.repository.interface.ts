import type { Member as DbMember } from '@/modules/users/datasources/entities/member.entity.db';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { Invitation } from '@/modules/users/domain/entities/invitation.entity';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type {
  FindManyOptions,
  FindOptionsRelations,
  FindOptionsWhere,
} from 'typeorm';
import type { Address } from 'viem';

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

  inviteUsers(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    users: Array<{
      address: Address;
      role: Member['role'];
      name: Member['name'];
    }>;
  }): Promise<Array<Invitation>>;

  acceptInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    payload: Pick<Member, 'name'>;
  }): Promise<void>;

  declineInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void>;

  findAuthorizedMembersOrFail(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Array<Member>>;

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
