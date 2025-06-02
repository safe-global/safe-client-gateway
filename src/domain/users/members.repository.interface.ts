import type { Member as DbMember } from '@/datasources/users/entities/member.entity.db';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { Space } from '@/domain/spaces/entities/space.entity';
import type { Invitation } from '@/domain/users/entities/invitation.entity';
import type { Member } from '@/domain/users/entities/member.entity';
import type { User } from '@/domain/users/entities/user.entity';
import type {
  FindManyOptions,
  FindOptionsRelations,
  FindOptionsWhere,
} from 'typeorm';

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
      address: `0x${string}`;
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
