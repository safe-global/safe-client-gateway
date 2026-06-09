// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { getAddress } from 'viem';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { addressBookItemBuilder } from '@/modules/spaces/domain/address-books/entities/__tests__/address-book-item.db.builder';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { AddressBooksService } from '@/modules/spaces/routes/address-books.service';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import { UserIdentityResolverService } from '@/modules/users/domain/user-identity-resolver.service';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { walletBuilder } from '@/modules/wallets/datasources/entities/__tests__/wallets.entity.db.builder';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

const repositoryMock = {
  findAllBySpaceId: jest.fn(),
  upsertMany: jest.fn(),
  deleteByAddress: jest.fn(),
} as jest.MockedObjectDeep<IAddressBookItemsRepository>;

const configurationServiceMock = {
  getOrThrow: jest.fn().mockReturnValue(20),
} as jest.MockedObjectDeep<IConfigurationService>;

const usersRepositoryMock = {
  find: jest.fn(),
} as jest.MockedObjectDeep<IUsersRepository>;

const walletsRepositoryMock = {
  find: jest.fn(),
} as jest.MockedObjectDeep<IWalletsRepository>;

const spacesRepositoryMock = {
  findUuidById: jest.fn(),
} as jest.MockedObjectDeep<ISpacesRepository>;

describe('AddressBooksService', () => {
  let service: AddressBooksService;

  beforeEach(() => {
    jest.resetAllMocks();
    configurationServiceMock.getOrThrow.mockReturnValue(20);
    usersRepositoryMock.find.mockResolvedValue([]);
    walletsRepositoryMock.find.mockResolvedValue([]);
    spacesRepositoryMock.findUuidById.mockResolvedValue(fakeUuid());
    service = new AddressBooksService(
      repositoryMock,
      new UserIdentityResolverService(
        usersRepositoryMock,
        walletsRepositoryMock,
      ),
      configurationServiceMock,
      spacesRepositoryMock,
    );
  });

  describe('findAllBySpaceId', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)('should return address book items for %s user', async (_label, builder) => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(builder().build());
      const items = [addressBookItemBuilder().build()];
      repositoryMock.findAllBySpaceId.mockResolvedValue(items);

      const result = await service.findAllBySpaceId(authPayload, spaceId);

      expect(result.spaceId).toBe(spaceId.toString());
      expect(result.data).toHaveLength(1);
      expect(repositoryMock.findAllBySpaceId).toHaveBeenCalledWith({
        authPayload,
        spaceId,
      });
    });

    it('should throw for unauthenticated user', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload();
      repositoryMock.findAllBySpaceId.mockRejectedValue(
        new UnauthorizedException('Not authenticated'),
      );

      await expect(
        service.findAllBySpaceId(authPayload, spaceId),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('upsertMany', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)('should upsert items for %s user', async (_label, builder) => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(builder().build());
      const items = faker.helpers.multiple(
        () => addressBookItemBuilder().build(),
        { count: { min: 2, max: 5 } },
      );
      repositoryMock.upsertMany.mockResolvedValue(items);

      const result = await service.upsertMany(authPayload, spaceId, {
        items: items.map((i) => ({
          address: i.address,
          name: i.name,
          chainIds: i.chainIds,
        })),
      });

      expect(result.spaceId).toBe(spaceId.toString());
      expect(result.data).toHaveLength(items.length);
      expect(repositoryMock.upsertMany).toHaveBeenCalled();
    });

    it('should propagate UnauthorizedException for unauthenticated user', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload();
      repositoryMock.upsertMany.mockRejectedValue(
        new UnauthorizedException('Not authenticated'),
      );

      await expect(
        service.upsertMany(authPayload, spaceId, { items: [] }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('identity resolution', () => {
    it('should resolve email for OIDC user into createdBy field', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const userId = faker.number.int({ min: 1, max: 1000 });
      const email = fakeEmailAddress();
      const items = [
        addressBookItemBuilder()
          .with('createdBy', userId)
          .with('lastUpdatedBy', userId)
          .build(),
      ];
      repositoryMock.upsertMany.mockResolvedValue(items);
      const user = userBuilder()
        .with('id', userId)
        .with('email', email)
        .build();
      usersRepositoryMock.find.mockResolvedValue([user]);

      const result = await service.upsertMany(authPayload, spaceId, {
        items: items.map((i) => ({
          address: i.address,
          name: i.name,
          chainIds: i.chainIds,
        })),
      });

      expect(result.data[0].createdBy).toBe(email);
      expect(result.data[0].createdByUserId).toBe(userId);
    });

    it('should resolve wallet address for SIWE user into createdBy field', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const userId = faker.number.int({ min: 1, max: 1000 });
      const user = userBuilder().with('id', userId).with('email', null).build();
      const wallet = walletBuilder().with('user', user).build();
      const items = [
        addressBookItemBuilder()
          .with('createdBy', userId)
          .with('lastUpdatedBy', userId)
          .build(),
      ];
      repositoryMock.upsertMany.mockResolvedValue(items);
      usersRepositoryMock.find.mockResolvedValue([user]);
      walletsRepositoryMock.find.mockResolvedValue([wallet]);

      const result = await service.upsertMany(authPayload, spaceId, {
        items: items.map((i) => ({
          address: i.address,
          name: i.name,
          chainIds: i.chainIds,
        })),
      });

      expect(result.data[0].createdBy).toBe(wallet.address);
      expect(result.data[0].createdByUserId).toBe(userId);
      expect(walletsRepositoryMock.find).toHaveBeenCalledWith({
        where: { user: { id: expect.anything() } },
        relations: { user: true },
      });
    });

    it('should resolve different identities for different creators', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const user1Email = fakeEmailAddress();
      const user1 = userBuilder().with('email', user1Email).build();
      const user2 = userBuilder().with('email', null).build();
      const user2Wallet = walletBuilder().with('user', user2).build();
      const items = [
        addressBookItemBuilder()
          .with('createdBy', user1.id)
          .with('lastUpdatedBy', user2.id)
          .build(),
        addressBookItemBuilder()
          .with('createdBy', user2.id)
          .with('lastUpdatedBy', user1.id)
          .build(),
      ];
      repositoryMock.findAllBySpaceId.mockResolvedValue(items);
      usersRepositoryMock.find.mockResolvedValue([user1, user2]);
      walletsRepositoryMock.find.mockResolvedValue([user2Wallet]);

      const result = await service.findAllBySpaceId(authPayload, spaceId);

      expect(result.data[0].createdBy).toBe(user1Email);
      expect(result.data[0].lastUpdatedBy).toBe(user2Wallet.address);
      expect(result.data[1].createdBy).toBe(user2Wallet.address);
      expect(result.data[1].lastUpdatedBy).toBe(user1Email);
    });

    it('should return "Unknown user" when user exists but has no wallet or email', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const userId = faker.number.int({ min: 1, max: 1000 });
      const user = userBuilder().with('id', userId).with('email', null).build();
      const items = [
        addressBookItemBuilder()
          .with('createdBy', userId)
          .with('lastUpdatedBy', userId)
          .build(),
      ];
      repositoryMock.findAllBySpaceId.mockResolvedValue(items);
      usersRepositoryMock.find.mockResolvedValue([user]);
      walletsRepositoryMock.find.mockResolvedValue([]);

      const result = await service.findAllBySpaceId(authPayload, spaceId);

      expect(result.data[0].createdBy).toBe('Unknown user');
      expect(result.data[0].createdByUserId).toBe(userId);
      expect(result.data[0].lastUpdatedBy).toBe('Unknown user');
      expect(result.data[0].lastUpdatedByUserId).toBe(userId);
    });

    it('should return "Deleted user" when user no longer exists', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const deletedUserId = faker.number.int({ min: 1, max: 1000 });
      const items = [
        addressBookItemBuilder()
          .with('createdBy', deletedUserId)
          .with('lastUpdatedBy', deletedUserId)
          .build(),
      ];
      repositoryMock.findAllBySpaceId.mockResolvedValue(items);
      usersRepositoryMock.find.mockResolvedValue([]);
      walletsRepositoryMock.find.mockResolvedValue([]);

      const result = await service.findAllBySpaceId(authPayload, spaceId);

      expect(result.data[0].createdBy).toBe('Deleted user');
      expect(result.data[0].createdByUserId).toBe(deletedUserId);
      expect(result.data[0].lastUpdatedBy).toBe('Deleted user');
      expect(result.data[0].lastUpdatedByUserId).toBe(deletedUserId);
    });
  });

  describe('deleteByAddress', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)('should delete for %s user', async (_label, builder) => {
      const spaceId = faker.number.int();
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayload = new AuthPayload(builder().build());
      repositoryMock.deleteByAddress.mockResolvedValue();

      await service.deleteByAddress({ authPayload, spaceId, address });

      expect(repositoryMock.deleteByAddress).toHaveBeenCalledWith({
        authPayload,
        spaceId,
        address,
      });
    });

    it('should propagate UnauthorizedException for unauthenticated user', async () => {
      const spaceId = faker.number.int();
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayload = new AuthPayload();
      repositoryMock.deleteByAddress.mockRejectedValue(
        new UnauthorizedException('Not authenticated'),
      );

      await expect(
        service.deleteByAddress({ authPayload, spaceId, address }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
