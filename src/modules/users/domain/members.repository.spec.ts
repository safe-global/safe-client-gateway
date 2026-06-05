// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { EntityManager } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import type { Mocked, MockedObject } from 'vitest';
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
    create: vi.fn(),
    findOrCreateByWalletAddress: vi.fn(),
    updateStatus: vi.fn(),
  } as MockedObject<IUsersRepository>;
  const spacesRepository = {
    findOneOrFail: vi.fn(),
  } as MockedObject<ISpacesRepository>;

  let entityManager: Mocked<
    Pick<EntityManager, 'find' | 'findOne' | 'insert' | 'update'>
  >;
  let postgresDatabaseService: MockedObject<PostgresDatabaseService>;
  let target: MembersRepository;

  const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
  const authenticatedUserId = Number(authPayload.sub);
  const space = spaceBuilder().with('members', []).build();
  let inviteExpiresAt: Date;

  beforeEach(() => {
    vi.resetAllMocks();

    inviteExpiresAt = faker.date.future();
    entityManager = {
      find: vi.fn(),
      findOne: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    };
    postgresDatabaseService = {
      transaction: vi
        .fn()
        .mockImplementation((callback) => callback(entityManager)),
    } as MockedObject<PostgresDatabaseService>;
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
});
