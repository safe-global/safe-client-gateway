// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { Member as DbMember } from '@/modules/users/datasources/entities/member.entity.db';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import { In } from 'typeorm';
import type {
  FindOptionsWhere,
  FindOptionsRelations,
  FindManyOptions,
  EntityManager,
} from 'typeorm';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type { Invitation } from '@/modules/users/domain/entities/invitation.entity';
import { type Member } from '@/modules/users/domain/entities/member.entity';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';

@Injectable()
export class MembersRepository implements IMembersRepository {
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
  ) {}

  public async findOneOrFail(
    where: Array<FindOptionsWhere<Member>> | FindOptionsWhere<Member>,
    relations?: FindOptionsRelations<Member>,
  ): Promise<DbMember> {
    const space = await this.findOne(where, relations);

    if (!space) {
      throw new NotFoundException('Member not found.');
    }

    return space;
  }

  public async findOne(
    where: Array<FindOptionsWhere<Member>> | FindOptionsWhere<Member>,
    relations?: FindOptionsRelations<Member>,
  ): Promise<DbMember | null> {
    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);

    return await membersRepository.findOne({
      where,
      relations,
    });
  }

  public async findOrFail(
    args?: FindManyOptions<DbMember>,
  ): Promise<[DbMember, ...Array<DbMember>]> {
    const members = await this.find(args);

    if (members.length === 0) {
      throw new NotFoundException('No members found.');
    }

    return members as [DbMember, ...Array<DbMember>];
  }

  public async find(
    args?: FindManyOptions<DbMember>,
  ): Promise<Array<DbMember>> {
    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);

    return await membersRepository.find(args);
  }

  public async inviteUsers(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    users: Array<{
      name: Member['name'];
      address: Address;
      role: Member['role'];
    }>;
  }): Promise<Array<Invitation>> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    const space = await this.spacesRepository.findOneOrFail({
      where: { id: args.spaceId },
    });
    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);
    const activeAdmin = await membersRepository.findOne({
      where: {
        user: { id: userId },
        space: { id: args.spaceId },
        status: 'ACTIVE',
        role: 'ADMIN',
      },
    });
    if (!activeAdmin) {
      throw new ForbiddenException('User is not an active admin.');
    }

    const invitedAddresses = args.users.map((user) => user.address);
    const invitedWallets = await this.walletsRepository.find({
      where: { address: In(invitedAddresses) },
      relations: { user: true },
    });
    const invitations: Array<Invitation> = [];

    // TODO: Until OIDC invite flow is set up, OIDC admins have no wallet
    // address to store here. Revisit when OIDC invite identifiers are available.
    const invitedBy = args.authPayload.isSiwe()
      ? args.authPayload.signer_address
      : null;

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      for (const userToInvite of args.users) {
        // Find existing User via Wallet or create new User and Wallet.
        const wallet = invitedWallets.find((wallet) => {
          return isAddressEqual(wallet.address, userToInvite.address);
        });
        const userIdToInvite = wallet
          ? wallet.user.id
          : await this.createUserAndWallet({
              entityManager,
              address: userToInvite.address,
            });

        try {
          await entityManager.insert(DbMember, {
            user: { id: userIdToInvite },
            space: space,
            name: userToInvite.name,
            role: userToInvite.role,
            status: 'INVITED',
            invitedBy,
          });
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            throw new UniqueConstraintError(
              `${userToInvite.address} is already in this space or has a pending invite.`,
            );
          }
          throw err;
        }

        invitations.push({
          userId: userIdToInvite,
          spaceId: space.id,
          name: userToInvite.name,
          role: userToInvite.role,
          status: 'INVITED',
          invitedBy,
        });
      }
    });

    return invitations;
  }

  private async createUserAndWallet(args: {
    entityManager: EntityManager;
    address: Address;
  }): Promise<User['id']> {
    const { address, entityManager } = args;
    const userId = await this.usersRepository.create('PENDING', entityManager);
    await this.walletsRepository.create(
      { walletAddress: address, userId },
      entityManager,
    );
    return userId;
  }

  public async acceptInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    payload: Pick<Member, 'name'>;
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    const space = await this.spacesRepository.findOneOrFail({
      where: {
        id: args.spaceId,
        members: { user: { id: userId }, status: 'INVITED' },
      },
      relations: { members: { user: true } },
    });
    const member = space.members[0];

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbMember, member.id, {
        status: 'ACTIVE',
        name: args.payload.name,
      });

      await this.usersRepository.updateStatus({
        userId,
        status: 'ACTIVE',
        entityManager,
      });
    });
  }

  public async declineInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    const space = await this.spacesRepository.findOneOrFail({
      where: {
        id: args.spaceId,
        members: { user: { id: userId }, status: 'INVITED' },
      },
      relations: { members: { user: true } },
    });
    const member = space.members[0];

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbMember, member.id, {
        status: 'DECLINED',
      });
    });
  }

  public async findAuthorizedMembersOrFail(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Array<Member>> {
    await this.findActiveOrInvitedMemberOrFail(args);
    const space = await this.spacesRepository.findOneOrFail({
      where: { id: args.spaceId },
      relations: { members: { user: true } },
    });

    return space.members;
  }

  public async findSelfMembershipOrFail(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Member> {
    return await this.findActiveOrInvitedMemberOrFail(args, {
      user: true,
    });
  }

  private findActiveAdminsOrFail(spaceId: Space['id']): Promise<Array<Member>> {
    return this.findOrFail({
      where: { space: { id: spaceId }, role: 'ADMIN', status: 'ACTIVE' },
      relations: { user: true },
    });
  }

  public async updateRole(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    userId: User['id'];
    role: Member['role'];
  }): Promise<void> {
    const actingUserId = getAuthenticatedUserIdOrFail(args.authPayload);

    const activeAdmins = await this.findActiveAdminsOrFail(args.spaceId);

    this.assertIsActiveAdmin({ members: activeAdmins, userId: actingUserId });
    const isSelf = actingUserId === args.userId;
    if (isSelf && args.role !== 'ADMIN') {
      this.assertIsNotLastAdmin({
        members: activeAdmins,
        userId: actingUserId,
      });
    }

    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);
    const updateResult = await membersRepository.update(
      { user: { id: args.userId }, space: { id: args.spaceId } },
      { role: args.role },
    );

    if (updateResult.affected === 0) {
      throw new NotFoundException('Member not found.');
    }
  }

  public async updateAlias(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    alias: Member['alias'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);
    const updateResult = await membersRepository.update(
      { user: { id: userId }, space: { id: args.spaceId } },
      { alias: args.alias },
    );

    if (updateResult.affected === 0) {
      throw new NotFoundException('Member not found.');
    }
  }

  public async removeUser(args: {
    authPayload: AuthPayload;
    userId: User['id'];
    spaceId: Space['id'];
  }): Promise<void> {
    const actingUserId = getAuthenticatedUserIdOrFail(args.authPayload);

    const activeAdmins = await this.findActiveAdminsOrFail(args.spaceId);

    this.assertIsActiveAdmin({ members: activeAdmins, userId: actingUserId });
    const isSelf = actingUserId === args.userId;
    if (isSelf) {
      this.assertIsNotLastAdmin({
        members: activeAdmins,
        userId: actingUserId,
      });
    }

    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);
    const deleteResult = await membersRepository.delete({
      user: { id: args.userId },
      space: { id: args.spaceId },
    });

    if (deleteResult.affected === 0) {
      throw new NotFoundException('Member not found.');
    }
  }

  public async removeSelf(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    const activeAdmins = await this.findActiveAdminsOrFail(args.spaceId);

    this.assertIsNotLastAdmin({ members: activeAdmins, userId });

    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);

    const deleteResult = await membersRepository.delete({
      user: { id: userId },
      space: { id: args.spaceId },
    });

    if (deleteResult.affected === 0) {
      throw new NotFoundException('Member not found.');
    }
  }

  private assertIsActiveAdmin(args: {
    members: Array<DbMember>;
    userId: User['id'];
  }): void {
    if (
      !args.members.some((member) => {
        return this.isActiveAdmin(member) && member.user.id === args.userId;
      })
    ) {
      throw new ForbiddenException('User is not an active admin.');
    }
  }

  private assertIsNotLastAdmin(args: {
    members: Array<DbMember>;
    userId: User['id'];
  }): void {
    if (
      args.members.length === 1 &&
      args.members[0].user.id === args.userId &&
      this.isActiveAdmin(args.members[0])
    ) {
      throw new ConflictException('Cannot remove last admin.');
    }
  }

  private isActiveAdmin(member: DbMember): boolean {
    return member.role === 'ADMIN' && member.status === 'ACTIVE';
  }

  /**
   * Returns the authenticated user's `ACTIVE` or `INVITED` membership row
   * for the given space, or throws `ForbiddenException` if none exists.
   *
   * Shared by {@link findAuthorizedMembersOrFail} (which uses it as an
   * authorization gate and discards the row, so it omits `relations`) and
   * by {@link findSelfMembershipOrFail} (which returns the row to the
   * caller and passes `{ user: true }` so the response includes
   * `user.status`).
   */
  private async findActiveOrInvitedMemberOrFail(
    args: {
      authPayload: AuthPayload;
      spaceId: Space['id'];
    },
    relations?: FindOptionsRelations<DbMember>,
  ): Promise<Member> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);
    const member = await membersRepository.findOne({
      where: {
        user: { id: userId },
        space: { id: args.spaceId },
        status: In(['ACTIVE', 'INVITED']),
      },
      relations,
    });
    if (!member) {
      throw new ForbiddenException(
        'The user is not an active member of the space.',
      );
    }
    return member;
  }
}
