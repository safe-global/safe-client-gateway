// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EntityManager,
  FindManyOptions,
  FindOptionsRelations,
  FindOptionsWhere,
} from 'typeorm';
import { In, IsNull } from 'typeorm';
import type { Address } from 'viem';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { Space as DbSpace } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import {
  InviteType,
  type InviteUserInput,
} from '@/modules/spaces/routes/members/entities/invite-users.dto.entity';
import { Member as DbMember } from '@/modules/users/datasources/entities/member.entity.db';
import type { Invitation } from '@/modules/users/domain/entities/invitation.entity';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { activeOrPendingMemberWhere } from '@/modules/users/domain/members/utils/members.utils';
import { UserEncryptionService } from '@/modules/users/domain/user-encryption.service';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';

@Injectable()
export class MembersRepository implements IMembersRepository {
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
    private readonly userEncryptionService: UserEncryptionService,
    private readonly walletEncryptionService: WalletEncryptionService,
  ) {}

  /**
   * Returns copies of loaded members with the `email` of their hydrated
   * users decrypted. Members loaded without the `user` relation are returned
   * as-is.
   */
  private async decryptMemberUserEmails(
    members: Array<DbMember>,
  ): Promise<Array<DbMember>> {
    const decryptedUsers = await this.userEncryptionService.decryptUserEmails(
      members.flatMap((member) => (member.user ? [member.user] : [])),
    );
    const usersById = new Map(decryptedUsers.map((user) => [user.id, user]));
    return members.map((member) =>
      member.user
        ? { ...member, user: usersById.get(member.user.id) ?? member.user }
        : member,
    );
  }

  private async findSpaceForAuditOrFail(
    entityManager: EntityManager,
    spaceId: Space['id'],
  ): Promise<Pick<DbSpace, 'id' | 'uuid'>> {
    const space = await entityManager.findOne(DbSpace, {
      where: { id: spaceId },
      select: { id: true, uuid: true },
    });
    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }
    return space;
  }

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

    const member = await membersRepository.findOne({
      where,
      relations,
    });
    if (!member) {
      return null;
    }
    const [decryptedMember] = await this.decryptMemberUserEmails([member]);
    return decryptedMember;
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

    const members = await membersRepository.find(args);
    return await this.decryptMemberUserEmails(members);
  }

  public async findActiveAdmin(args: {
    userId: User['id'];
    spaceId: Space['id'];
  }): Promise<DbMember | null> {
    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);

    return await membersRepository.findOne({
      where: {
        user: { id: args.userId },
        space: { id: args.spaceId },
        status: 'ACTIVE',
        role: 'ADMIN',
      },
    });
  }

  public async inviteUsers(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    users: Array<InviteUserInput>;
    inviteExpiresAt: Date;
  }): Promise<Array<Invitation>> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    const space = await this.spacesRepository.findOneOrFail({
      where: { id: args.spaceId },
    });

    const invitations: Array<Invitation> = [];
    const walletAddresses = args.users.flatMap((user) =>
      user.type === InviteType.Wallet ? [user.address] : [],
    );

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const walletUserIds = new Map<Address, User['id']>();
      if (walletAddresses.length > 0) {
        // Batch existing wallet lookups while keeping user creation atomic.
        // Dual-read during the backfill window: encrypted rows match on the
        // blind index, rows the backfill has not reached yet
        // (address_index IS NULL) still match on plaintext. The plaintext
        // arm is removed together with restoring the throw-on-plaintext
        // guard once the backfill --verify passes.
        const indexByAddress = new Map<Address, string | null>(
          walletAddresses.map((address) => [
            address,
            this.walletEncryptionService.addressIndex(address),
          ]),
        );
        const indexes = [...indexByAddress.values()].filter(
          (index): index is string => index !== null,
        );
        const wallets = await entityManager.find(Wallet, {
          where: [
            ...(indexes.length > 0 ? [{ addressIndex: In(indexes) }] : []),
            { addressIndex: IsNull(), address: In(walletAddresses) },
          ],
          relations: { user: true },
        });

        // Map each row back to the caller's plaintext address: encrypted
        // rows via their blind index (no KMS round trip - the plaintext is
        // the invite input), un-backfilled rows via the stored plaintext.
        const addressByIndex = new Map<string, Address>();
        for (const [address, index] of indexByAddress) {
          if (index !== null) {
            addressByIndex.set(index, address);
          }
        }
        for (const wallet of wallets) {
          const address = wallet.addressIndex
            ? addressByIndex.get(wallet.addressIndex)
            : wallet.address;
          if (address) {
            walletUserIds.set(address, wallet.user.id);
          }
        }
      }

      for (const userToInvite of args.users) {
        let userIdToInvite: User['id'];
        switch (userToInvite.type) {
          case InviteType.Wallet: {
            userIdToInvite =
              walletUserIds.get(userToInvite.address) ??
              (await this.usersRepository.findOrCreateByWalletAddress(
                userToInvite.address,
                'PENDING',
                entityManager,
              ));
            walletUserIds.set(userToInvite.address, userIdToInvite);
            break;
          }
          case InviteType.Email: {
            userIdToInvite = await this.usersRepository.findOrCreateByEmail(
              userToInvite.email,
              entityManager,
            );
            break;
          }
        }

        const { reinvite } = await this.insertOrUpdateInvite({
          entityManager,
          space,
          userId: userIdToInvite,
          userToInvite,
          invitedBy: userId,
          inviteExpiresAt: args.inviteExpiresAt,
        });

        await this.spaceAuditRepository.record(entityManager, {
          spaceId: space.id,
          spaceUuid: space.uuid,
          eventType: SpaceAuditEventType.MEMBER_INVITED,
          actorUserId: userId,
          payload: {
            targetUserId: userIdToInvite,
            role: userToInvite.role,
            ...(reinvite && { reinvite }),
          },
        });

        invitations.push({
          userId: userIdToInvite,
          spaceId: space.id,
          spaceUuid: space.uuid,
          name: userToInvite.name,
          role: userToInvite.role,
          status: 'INVITED',
          invitedBy: userId,
        });
      }
    });

    return invitations;
  }

  /** @returns `reinvite: true` when an existing `INVITED` member was updated. */
  private async insertOrUpdateInvite(args: {
    entityManager: EntityManager;
    space: Space;
    userId: User['id'];
    userToInvite: InviteUserInput;
    invitedBy: number | null;
    inviteExpiresAt: Date;
  }): Promise<{ reinvite: boolean }> {
    const {
      entityManager,
      space,
      userId,
      userToInvite,
      invitedBy,
      inviteExpiresAt,
    } = args;
    const { name, role } = userToInvite;

    const duplicateInviteError = (): UniqueConstraintError =>
      new UniqueConstraintError(
        userToInvite.type === InviteType.Wallet
          ? `${userToInvite.address} is already in this workspace or has a pending invite.`
          : 'This invitee is already in this workspace or has a pending invite.',
      );

    const existingMember = await entityManager.findOne(DbMember, {
      where: {
        user: { id: userId },
        space: { id: space.id },
      },
    });

    if (!existingMember) {
      try {
        await entityManager.insert(DbMember, {
          user: { id: userId },
          space,
          name,
          role,
          status: 'INVITED',
          invitedBy,
          inviteExpiresAt,
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw duplicateInviteError();
        }
        throw err;
      }
      return { reinvite: false };
    }

    if (existingMember.status === 'INVITED') {
      await entityManager.update(DbMember, existingMember.id, {
        name,
        role,
        invitedBy,
        inviteExpiresAt,
      });
      return { reinvite: true };
    }

    throw duplicateInviteError();
  }

  public async renewInvite(args: {
    memberId: Member['id'];
    inviteExpiresAt: Date;
    spaceId: Space['id'];
    spaceUuid: UUID;
    targetUserId: User['id'];
    actorUserId: User['id'];
  }): Promise<void> {
    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbMember, args.memberId, {
        inviteExpiresAt: args.inviteExpiresAt,
      });

      await this.spaceAuditRepository.record(entityManager, {
        spaceId: args.spaceId,
        spaceUuid: args.spaceUuid,
        eventType: SpaceAuditEventType.MEMBER_INVITE_RENEWED,
        actorUserId: args.actorUserId,
        payload: { targetUserId: args.targetUserId },
      });
    });
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
    this.assertInviteNotExpired(member);

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbMember, member.id, {
        status: 'ACTIVE',
        name: args.payload.name,
        inviteExpiresAt: null,
      });

      await this.usersRepository.updateStatus({
        userId,
        status: 'ACTIVE',
        entityManager,
      });

      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.MEMBER_INVITE_ACCEPTED,
        actorUserId: userId,
        payload: { targetUserId: userId },
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
    this.assertInviteNotExpired(member);

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbMember, member.id, {
        status: 'DECLINED',
        inviteExpiresAt: null,
      });

      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.MEMBER_INVITE_DECLINED,
        actorUserId: userId,
        payload: { targetUserId: userId },
      });
    });
  }

  private assertInviteNotExpired(member: DbMember): void {
    // An `INVITED` member is always expected to carry an expiry;
    // treat a missing one as expired.
    if (
      member.inviteExpiresAt === null ||
      member.inviteExpiresAt.getTime() <= Date.now()
    ) {
      throw new GoneException('Invitation has expired.');
    }
  }

  public async findAuthorizedMembersOrFail(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Array<Member>> {
    // A pending caller gets only their own invitation row, never the roster
    // (the wallet derives its invite banner from this endpoint).
    const own = await this.findActiveOrInvitedMemberOrFail(args, {
      user: true,
    });
    if (own.status !== 'ACTIVE') {
      return [own];
    }

    const space = await this.spacesRepository.findOneOrFail({
      where: { id: args.spaceId },
      relations: { members: { user: true } },
    });

    return await this.decryptMemberUserEmails(space.members);
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

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const member = await entityManager.findOne(DbMember, {
        where: { user: { id: args.userId }, space: { id: args.spaceId } },
      });
      if (!member) {
        throw new NotFoundException('Member not found.');
      }

      await entityManager.update(DbMember, member.id, { role: args.role });

      const space = await this.findSpaceForAuditOrFail(
        entityManager,
        args.spaceId,
      );
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.MEMBER_ROLE_UPDATED,
        actorUserId: actingUserId,
        payload: {
          targetUserId: args.userId,
          oldRole: member.role,
          newRole: args.role,
        },
      });
    });
  }

  public async updateAlias(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    alias: Member['alias'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const member = await entityManager.findOne(DbMember, {
        where: { user: { id: userId }, space: { id: args.spaceId } },
      });
      if (!member) {
        throw new NotFoundException('Member not found.');
      }
      if (member.status !== 'ACTIVE') {
        throw new ForbiddenException(
          'The user is not an active member of the workspace.',
        );
      }

      await entityManager.update(DbMember, member.id, { alias: args.alias });

      const space = await this.findSpaceForAuditOrFail(
        entityManager,
        args.spaceId,
      );
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.MEMBER_ALIAS_UPDATED,
        actorUserId: userId,
        payload: { targetUserId: userId },
      });
    });
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

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const member = await entityManager.findOne(DbMember, {
        where: { user: { id: args.userId }, space: { id: args.spaceId } },
      });
      if (!member) {
        throw new NotFoundException('Member not found.');
      }

      await entityManager.delete(DbMember, member.id);

      const space = await this.findSpaceForAuditOrFail(
        entityManager,
        args.spaceId,
      );
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.MEMBER_REMOVED,
        actorUserId: actingUserId,
        payload: { targetUserId: args.userId },
      });
    });
  }

  public async removeSelf(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    const activeAdmins = await this.findActiveAdminsOrFail(args.spaceId);

    this.assertIsNotLastAdmin({ members: activeAdmins, userId });

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const member = await entityManager.findOne(DbMember, {
        where: { user: { id: userId }, space: { id: args.spaceId } },
      });
      if (!member) {
        throw new NotFoundException('Member not found.');
      }

      await entityManager.delete(DbMember, member.id);

      const space = await this.findSpaceForAuditOrFail(
        entityManager,
        args.spaceId,
      );
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.MEMBER_LEFT,
        actorUserId: userId,
        payload: { targetUserId: userId },
      });
    });
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
   * Returns the authenticated user's `ACTIVE` or non-expired `INVITED`
   * membership row for the given space, or throws `ForbiddenException` if none
   * exists.
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
      where: activeOrPendingMemberWhere<DbMember>(() => ({
        user: { id: userId },
        space: { id: args.spaceId },
      })),
      relations,
    });
    if (!member) {
      throw new ForbiddenException(
        'The user is not an active member of the workspace.',
      );
    }
    const [decryptedMember] = await this.decryptMemberUserEmails([member]);
    return decryptedMember;
  }
}
