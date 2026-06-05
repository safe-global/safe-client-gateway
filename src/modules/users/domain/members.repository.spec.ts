// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { InviteType } from '@/modules/spaces/routes/entities/invite-users.dto.entity';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { Member as DbMember } from '@/modules/users/datasources/entities/member.entity.db';
import { MembersRepository } from '@/modules/users/domain/members.repository';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { walletBuilder } from '@/modules/wallets/datasources/entities/__tests__/wallets.entity.db.builder';

describe('MembersRepository', () => {
  const usersRepository = {
    create: jest.fn(),
    findOrCreateByWalletAddress: jest.fn(),
    updateStatus: jest.fn(),
  } as jest.MockedObjectDeep<IUsersRepository>;
  const spacesRepository = {
    findOneOrFail: jest.fn(),
  } as jest.MockedObjectDeep<ISpacesRepository>;

  let entityManager: jest.Mocked<
    Pick<EntityManager, 'find' | 'findOne' | 'insert' | 'update'>
  >;
  let postgresDatabaseService: jest.MockedObjectDeep<PostgresDatabaseService>;
  let target: MembersRepository;

  const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
  const authenticatedUserId = Number(authPayload.sub);
  const space = spaceBuilder().with('members', []).build();
  let inviteExpiresAt: Date;

  beforeEach(() => {
    jest.resetAllMocks();

    inviteExpiresAt = faker.date.future();
    entityManager = {
      find: jest.fn(),
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    postgresDatabaseService = {
      transaction: jest
        .fn()
        .mockImplementation((callback) => callback(entityManager)),
    } as jest.MockedObjectDeep<PostgresDatabaseService>;
    spacesRepository.findOneOrFail.mockResolvedValue(space);

    target = new MembersRepository(
      postgresDatabaseService,
      usersRepository,
      spacesRepository,
    );
  });

  describe('inviteUsers', () => {
    it('should insert a member invite when the user is not already in the space', async () => {
      const wallet = walletBuilder().build();
      const userToInvite = {
        type: InviteType.Wallet,
        address: wallet.address,
        role: 'MEMBER' as const,
        name: nameBuilder(),
      };
      entityManager.find.mockResolvedValue([wallet]);
      entityManager.findOne.mockResolvedValue(null);

      await expect(
        target.inviteUsers({
          authPayload,
          spaceId: space.id,
          users: [userToInvite],
          inviteExpiresAt,
        }),
      ).resolves.toEqual([
        {
          userId: wallet.user.id,
          spaceId: space.id,
          name: userToInvite.name,
          role: userToInvite.role,
          status: 'INVITED',
          invitedBy: authenticatedUserId,
        },
      ]);

      expect(entityManager.insert).toHaveBeenCalledWith(DbMember, {
        user: { id: wallet.user.id },
        space,
        name: userToInvite.name,
        role: userToInvite.role,
        status: 'INVITED',
        invitedBy: authenticatedUserId,
        inviteExpiresAt,
      });
    });

    it('should overwrite the stale invite metadata of an existing invited member', async () => {
      const staleInvitedBy = authenticatedUserId + 1;
      const staleInviteExpiresAt = faker.date.past();
      const existingMember = memberBuilder()
        .with('space', space)
        .with('status', 'INVITED')
        .with('role', 'MEMBER')
        .with('invitedBy', staleInvitedBy)
        .with('inviteExpiresAt', staleInviteExpiresAt)
        .build();
      const wallet = walletBuilder().with('user', existingMember.user).build();
      const userToInvite = {
        type: InviteType.Wallet,
        address: wallet.address,
        role: 'ADMIN' as const,
        name: nameBuilder(),
      };
      entityManager.find.mockResolvedValue([wallet]);
      entityManager.findOne.mockResolvedValue(existingMember);

      await target.inviteUsers({
        authPayload,
        spaceId: space.id,
        users: [userToInvite],
        inviteExpiresAt,
      });

      // The re-invite refreshes name, role and the invite metadata
      // (invitedBy + inviteExpiresAt) rather than preserving the stale values.
      expect(entityManager.update).toHaveBeenCalledWith(
        DbMember,
        existingMember.id,
        {
          name: userToInvite.name,
          role: userToInvite.role,
          invitedBy: authenticatedUserId,
          inviteExpiresAt,
        },
      );
      expect(entityManager.update).not.toHaveBeenCalledWith(
        DbMember,
        existingMember.id,
        expect.objectContaining({ role: existingMember.role }),
      );
      expect(entityManager.update).not.toHaveBeenCalledWith(
        DbMember,
        existingMember.id,
        expect.objectContaining({ invitedBy: staleInvitedBy }),
      );
      expect(entityManager.update).not.toHaveBeenCalledWith(
        DbMember,
        existingMember.id,
        expect.objectContaining({ inviteExpiresAt: staleInviteExpiresAt }),
      );
      expect(entityManager.insert).not.toHaveBeenCalled();
    });

    it('should throw without attempting an insert when the existing member is active', async () => {
      const existingMember = memberBuilder()
        .with('space', space)
        .with('status', 'ACTIVE')
        .build();
      const wallet = walletBuilder().with('user', existingMember.user).build();
      const userToInvite = {
        type: InviteType.Wallet,
        address: wallet.address,
        role: 'ADMIN' as const,
        name: nameBuilder(),
      };
      entityManager.find.mockResolvedValue([wallet]);
      entityManager.findOne.mockResolvedValue(existingMember);

      await expect(
        target.inviteUsers({
          authPayload,
          spaceId: space.id,
          users: [userToInvite],
          inviteExpiresAt,
        }),
      ).rejects.toThrow(
        new UniqueConstraintError(
          `${wallet.address} is already in this workspace or has a pending invite.`,
        ),
      );
      expect(entityManager.insert).not.toHaveBeenCalled();
      expect(entityManager.update).not.toHaveBeenCalled();
    });

    it('should throw without attempting an insert when the existing member declined', async () => {
      // A declined invite cannot be resent: re-inviting must be rejected
      // rather than reviving the member.
      const existingMember = memberBuilder()
        .with('space', space)
        .with('status', 'DECLINED')
        .build();
      const wallet = walletBuilder().with('user', existingMember.user).build();
      const userToInvite = {
        type: InviteType.Wallet,
        address: wallet.address,
        role: 'ADMIN' as const,
        name: nameBuilder(),
      };
      entityManager.find.mockResolvedValue([wallet]);
      entityManager.findOne.mockResolvedValue(existingMember);

      await expect(
        target.inviteUsers({
          authPayload,
          spaceId: space.id,
          users: [userToInvite],
          inviteExpiresAt,
        }),
      ).rejects.toThrow(
        new UniqueConstraintError(
          `${wallet.address} is already in this workspace or has a pending invite.`,
        ),
      );
      expect(entityManager.insert).not.toHaveBeenCalled();
      expect(entityManager.update).not.toHaveBeenCalled();
    });

    it('should translate insert unique constraint races to a domain error', async () => {
      const wallet = walletBuilder().build();
      const userToInvite = {
        type: InviteType.Wallet,
        address: wallet.address,
        role: 'MEMBER' as const,
        name: nameBuilder(),
      };
      entityManager.find.mockResolvedValue([wallet]);
      entityManager.findOne.mockResolvedValue(null);
      entityManager.insert.mockRejectedValue(
        new QueryFailedError(
          '',
          [],
          Object.assign(new Error(), { code: '23505' }),
        ),
      );

      await expect(
        target.inviteUsers({
          authPayload,
          spaceId: space.id,
          users: [userToInvite],
          inviteExpiresAt,
        }),
      ).rejects.toThrow(
        new UniqueConstraintError(
          `${wallet.address} is already in this workspace or has a pending invite.`,
        ),
      );
      expect(entityManager.insert).toHaveBeenCalled();
    });
  });

  describe('renewInvite', () => {
    let dbMembersRepository: { findOne: jest.Mock };

    beforeEach(() => {
      dbMembersRepository = { findOne: jest.fn() };
      postgresDatabaseService.getRepository = jest
        .fn()
        .mockResolvedValue(dbMembersRepository);
    });

    it('should refresh the expiry of a pending invite, preserving the invite metadata', async () => {
      const existingMember = memberBuilder()
        .with('space', space)
        .with('status', 'INVITED')
        .with('role', 'MEMBER')
        .with('invitedBy', authenticatedUserId)
        .with('inviteExpiresAt', faker.date.past())
        .build();
      dbMembersRepository.findOne.mockResolvedValue(existingMember);

      await expect(
        target.renewInvite({
          spaceId: space.id,
          userId: existingMember.user.id,
          inviteExpiresAt,
        }),
      ).resolves.toEqual({
        userId: existingMember.user.id,
        spaceId: space.id,
        name: existingMember.name,
        role: existingMember.role,
        status: 'INVITED',
        invitedBy: existingMember.invitedBy,
      });

      expect(entityManager.update).toHaveBeenCalledWith(
        DbMember,
        existingMember.id,
        { inviteExpiresAt },
      );
    });

    it('should throw a NotFoundException when the member does not exist', async () => {
      dbMembersRepository.findOne.mockResolvedValue(null);

      await expect(
        target.renewInvite({
          spaceId: space.id,
          userId: faker.number.int(),
          inviteExpiresAt,
        }),
      ).rejects.toThrow(new NotFoundException('Member not found.'));
      expect(entityManager.update).not.toHaveBeenCalled();
    });

    it('should throw a ConflictException when the member is active', async () => {
      const existingMember = memberBuilder()
        .with('space', space)
        .with('status', 'ACTIVE')
        .build();
      dbMembersRepository.findOne.mockResolvedValue(existingMember);

      await expect(
        target.renewInvite({
          spaceId: space.id,
          userId: existingMember.user.id,
          inviteExpiresAt,
        }),
      ).rejects.toThrow(
        new ConflictException('Only a pending invitation can be renewed.'),
      );
      expect(entityManager.update).not.toHaveBeenCalled();
    });

    it('should throw a ConflictException when the member declined (not renewable)', async () => {
      const existingMember = memberBuilder()
        .with('space', space)
        .with('status', 'DECLINED')
        .build();
      dbMembersRepository.findOne.mockResolvedValue(existingMember);

      await expect(
        target.renewInvite({
          spaceId: space.id,
          userId: existingMember.user.id,
          inviteExpiresAt,
        }),
      ).rejects.toThrow(
        new ConflictException('Only a pending invitation can be renewed.'),
      );
      expect(entityManager.update).not.toHaveBeenCalled();
    });
  });
});
