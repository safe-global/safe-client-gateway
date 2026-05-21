// SPDX-License-Identifier: FSL-1.1-MIT

import type { EntityManager } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { Member as DbMember } from '@/modules/users/datasources/entities/member.entity.db';
import { MembersRepository } from '@/modules/users/domain/members.repository';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { walletBuilder } from '@/modules/wallets/datasources/entities/__tests__/wallets.entity.db.builder';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

describe('MembersRepository', () => {
  const usersRepository = {
    create: jest.fn(),
    updateStatus: jest.fn(),
  } as unknown as jest.MockedObjectDeep<IUsersRepository>;
  const spacesRepository = {
    findOneOrFail: jest.fn(),
  } as unknown as jest.MockedObjectDeep<ISpacesRepository>;
  const walletsRepository = {
    find: jest.fn(),
  } as unknown as jest.MockedObjectDeep<IWalletsRepository>;

  let entityManager: jest.Mocked<
    Pick<EntityManager, 'findOne' | 'insert' | 'update'>
  >;
  let postgresDatabaseService: jest.MockedObjectDeep<PostgresDatabaseService>;
  let target: MembersRepository;

  const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
  const space = spaceBuilder().with('members', []).build();
  const inviteExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

  beforeEach(() => {
    jest.resetAllMocks();

    entityManager = {
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    postgresDatabaseService = {
      transaction: jest
        .fn()
        .mockImplementation((callback) => callback(entityManager)),
    } as unknown as jest.MockedObjectDeep<PostgresDatabaseService>;
    spacesRepository.findOneOrFail.mockResolvedValue(space);

    target = new MembersRepository(
      postgresDatabaseService,
      usersRepository,
      spacesRepository,
      walletsRepository,
    );
  });

  describe('inviteUsers', () => {
    it('should insert a member invite when the user is not already in the space', async () => {
      const wallet = walletBuilder().build();
      const userToInvite = {
        address: wallet.address,
        role: 'MEMBER' as const,
        name: nameBuilder(),
      };
      walletsRepository.find.mockResolvedValue([wallet]);
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
          invitedBy: authPayload.signer_address,
        },
      ]);

      expect(entityManager.insert).toHaveBeenCalledWith(DbMember, {
        user: { id: wallet.user.id },
        space,
        name: userToInvite.name,
        role: userToInvite.role,
        status: 'INVITED',
        invitedBy: authPayload.signer_address,
        inviteExpiresAt,
      });
    });

    it('should update an existing invited member', async () => {
      const existingMember = memberBuilder()
        .with('space', space)
        .with('status', 'INVITED')
        .build();
      const wallet = walletBuilder().with('user', existingMember.user).build();
      const userToInvite = {
        address: wallet.address,
        role: 'ADMIN' as const,
        name: nameBuilder(),
      };
      walletsRepository.find.mockResolvedValue([wallet]);
      entityManager.findOne.mockResolvedValue(existingMember);

      await target.inviteUsers({
        authPayload,
        spaceId: space.id,
        users: [userToInvite],
        inviteExpiresAt,
      });

      expect(entityManager.update).toHaveBeenCalledWith(
        DbMember,
        existingMember.id,
        {
          name: userToInvite.name,
          role: userToInvite.role,
          invitedBy: authPayload.signer_address,
          inviteExpiresAt,
        },
      );
      expect(entityManager.insert).not.toHaveBeenCalled();
    });

    it('should throw when the existing member is active', async () => {
      const existingMember = memberBuilder()
        .with('space', space)
        .with('status', 'ACTIVE')
        .build();
      const wallet = walletBuilder().with('user', existingMember.user).build();
      const userToInvite = {
        address: wallet.address,
        role: 'ADMIN' as const,
        name: nameBuilder(),
      };
      walletsRepository.find.mockResolvedValue([wallet]);
      entityManager.findOne.mockResolvedValue(existingMember);

      await expect(
        target.inviteUsers({
          authPayload,
          spaceId: space.id,
          users: [userToInvite],
          inviteExpiresAt,
        }),
      ).rejects.toThrow(UniqueConstraintError);
    });

    it('should translate insert unique constraint races to a domain error', async () => {
      const wallet = walletBuilder().build();
      const userToInvite = {
        address: wallet.address,
        role: 'MEMBER' as const,
        name: nameBuilder(),
      };
      walletsRepository.find.mockResolvedValue([wallet]);
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
      ).rejects.toThrow(UniqueConstraintError);
    });
  });
});
