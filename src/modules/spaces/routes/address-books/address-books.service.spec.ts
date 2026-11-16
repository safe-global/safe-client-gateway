// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import type { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import type { IAddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { IAddressBookTagsRepository } from '#/modules/spaces/domain/address-books/address-book-tags.repository.interface';
import { addressBookItemBuilder } from '#/modules/spaces/domain/address-books/entities/__tests__/address-book-item.db.builder';
import { addressBookTagBuilder } from '#/modules/spaces/domain/address-books/entities/__tests__/address-book-tag.builder';
import type { ISpacesRepository } from '#/modules/spaces/domain/spaces.repository.interface';
import { AddressBooksService } from '#/modules/spaces/routes/address-books/address-books.service';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { userBuilder } from '#/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import { UserIdentityResolverService } from '#/modules/users/domain/user-identity-resolver/user-identity-resolver.service';
import type { IUsersRepository } from '#/modules/users/domain/users.repository.interface';
import { walletBuilder } from '#/modules/wallets/datasources/entities/__tests__/wallets.entity.db.builder';
import { createMockWalletEncryptionService } from '#/modules/wallets/domain/__tests__/wallet-encryption.service.mock';
import type { IWalletsRepository } from '#/modules/wallets/domain/wallets.repository.interface';
import { fakeEmailAddress } from '#/validation/entities/schemas/__tests__/email-address.builder';
import { fakeUuid } from '#/validation/entities/schemas/__tests__/uuid.builder';

const repositoryMock = {
  findAllBySpaceId: vi.fn(),
  upsertMany: vi.fn(),
  deleteByAddress: vi.fn(),
} as MockedObject<IAddressBookItemsRepository>;

const MAX_ADDRESS_BOOK_ITEMS = 20;

const usersRepositoryMock = {
  find: vi.fn(),
} as MockedObject<IUsersRepository>;

const walletsRepositoryMock = {
  find: vi.fn(),
} as MockedObject<IWalletsRepository>;

const spacesRepositoryMock = {
  findUuidById: vi.fn(),
} as MockedObject<ISpacesRepository>;

const membersRepositoryMock = {
  findOne: vi.fn(),
} as MockedObject<IMembersRepository>;

const tagsRepositoryMock = {
  findBySpaceId: vi.fn(),
  lockSpaceForTagWrites: vi.fn(),
  setTagsForItems: vi.fn(),
  createTag: vi.fn(),
  renameTag: vi.fn(),
  deleteTag: vi.fn(),
} as MockedObject<IAddressBookTagsRepository>;

const entityManager = {} as EntityManager;

const postgresDatabaseServiceMock = {
  transaction: vi.fn(),
} as MockedObject<PostgresDatabaseService>;

describe('AddressBooksService', () => {
  let service: AddressBooksService;

  beforeEach(() => {
    vi.resetAllMocks();
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'spaces.addressBooks.maxItems',
      MAX_ADDRESS_BOOK_ITEMS,
    );
    usersRepositoryMock.find.mockResolvedValue([]);
    walletsRepositoryMock.find.mockResolvedValue([]);
    spacesRepositoryMock.findUuidById.mockResolvedValue(fakeUuid());
    // Default: the caller is an active admin, so both the member-gated read
    // and the admin-gated writes pass unless a spec overrides this.
    membersRepositoryMock.findOne.mockResolvedValue(
      memberBuilder().with('role', 'ADMIN').with('status', 'ACTIVE').build(),
    );
    tagsRepositoryMock.findBySpaceId.mockResolvedValue({
      tags: [],
      itemTagIds: new Map(),
    });
    postgresDatabaseServiceMock.transaction.mockImplementation((callback) =>
      callback(entityManager),
    );
    service = new AddressBooksService(
      repositoryMock,
      new UserIdentityResolverService(
        usersRepositoryMock,
        walletsRepositoryMock,
        createMockWalletEncryptionService(),
      ),
      fakeConfigurationService,
      spacesRepositoryMock,
      membersRepositoryMock,
      tagsRepositoryMock,
      postgresDatabaseServiceMock,
    );
  });

  describe('findAllBySpaceId', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should return address book items for %s user',
      async (_label, builder) => {
        const spaceId = faker.number.int();
        const authPayload = new AuthPayload(builder().build());
        const items = [addressBookItemBuilder().build()];
        repositoryMock.findAllBySpaceId.mockResolvedValue(items);

        const result = await service.findAllBySpaceId(authPayload, spaceId);

        expect(result.spaceUuid).toEqual(expect.any(String));
        expect(result.data).toHaveLength(1);
        expect(repositoryMock.findAllBySpaceId).toHaveBeenCalledWith(spaceId);
      },
    );

    it('should return the tags of the space and the tag ids of each item', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const [taggedItem, untaggedItem] = [
        addressBookItemBuilder().build(),
        addressBookItemBuilder().build(),
      ];
      const tags = faker.helpers.multiple(
        () => addressBookTagBuilder().build(),
        {
          count: { min: 1, max: 3 },
        },
      );
      repositoryMock.findAllBySpaceId.mockResolvedValue([
        taggedItem,
        untaggedItem,
      ]);
      tagsRepositoryMock.findBySpaceId.mockResolvedValue({
        tags,
        itemTagIds: new Map([[taggedItem.id, tags.map((tag) => tag.id)]]),
      });

      const result = await service.findAllBySpaceId(authPayload, spaceId);

      expect(result.tags).toEqual(tags);
      expect(result.data).toEqual([
        expect.objectContaining({
          address: taggedItem.address,
          tagIds: tags.map((tag) => tag.id),
        }),
        expect.objectContaining({ address: untaggedItem.address, tagIds: [] }),
      ]);
      expect(tagsRepositoryMock.findBySpaceId).toHaveBeenCalledWith(spaceId);
    });

    it('should allow an active MEMBER to read the address book', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(
        memberBuilder().with('role', 'MEMBER').with('status', 'ACTIVE').build(),
      );
      repositoryMock.findAllBySpaceId.mockResolvedValue([]);

      await expect(
        service.findAllBySpaceId(authPayload, spaceId),
      ).resolves.toEqual(expect.objectContaining({ data: [] }));

      expect(membersRepositoryMock.findOne).toHaveBeenCalledWith({
        user: { id: Number(authPayload.sub) },
        space: { id: spaceId },
        status: 'ACTIVE',
      });
    });

    it('should throw a 403 when the caller is not an active member', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.findAllBySpaceId(authPayload, spaceId),
      ).rejects.toThrow(
        new HttpExceptionNoLog(
          'User is not a member of this workspace',
          HttpStatus.FORBIDDEN,
        ),
      );
      expect(repositoryMock.findAllBySpaceId).not.toHaveBeenCalled();
    });

    it('should throw for unauthenticated user', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload();

      await expect(
        service.findAllBySpaceId(authPayload, spaceId),
      ).rejects.toThrow(UnauthorizedException);
      expect(membersRepositoryMock.findOne).not.toHaveBeenCalled();
      expect(repositoryMock.findAllBySpaceId).not.toHaveBeenCalled();
    });
  });

  describe('upsertMany', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)('should upsert items for %s admin', async (_label, builder) => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(builder().build());
      const items = faker.helpers.multiple(
        () => addressBookItemBuilder().build(),
        { count: { min: 2, max: 5 } },
      );
      const payload = items.map((i) => ({
        address: i.address,
        name: i.name,
        chainIds: i.chainIds,
      }));
      repositoryMock.upsertMany.mockResolvedValue(items);

      const result = await service.upsertMany(authPayload, spaceId, {
        items: payload,
      });

      expect(result.spaceUuid).toEqual(expect.any(String));
      expect(result.data).toHaveLength(items.length);
      expect(membersRepositoryMock.findOne).toHaveBeenCalledWith({
        user: { id: Number(authPayload.sub) },
        space: { id: spaceId },
        status: 'ACTIVE',
        role: 'ADMIN',
      });
      // No tags: no service transaction, the repository opens its own.
      expect(repositoryMock.upsertMany).toHaveBeenCalledExactlyOnceWith({
        userId: Number(authPayload.sub),
        spaceId,
        addressBookItems: payload,
      });
      expect(postgresDatabaseServiceMock.transaction).not.toHaveBeenCalled();
      expect(tagsRepositoryMock.lockSpaceForTagWrites).not.toHaveBeenCalled();
      expect(tagsRepositoryMock.setTagsForItems).not.toHaveBeenCalled();
    });

    it('should lock, upsert and then tag the items that carry tags, in one transaction', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const [tagged, untagged] = [
        addressBookItemBuilder().build(),
        addressBookItemBuilder().build(),
      ];
      const tags = faker.helpers.multiple(() => faker.word.noun(), {
        count: { min: 0, max: 3 },
      });
      const payload = [
        {
          address: tagged.address,
          name: tagged.name,
          chainIds: tagged.chainIds,
          tags,
        },
        {
          address: untagged.address,
          name: untagged.name,
          chainIds: untagged.chainIds,
        },
      ];
      repositoryMock.upsertMany.mockResolvedValue([tagged, untagged]);

      await service.upsertMany(authPayload, spaceId, { items: payload });

      expect(postgresDatabaseServiceMock.transaction).toHaveBeenCalledOnce();
      expect(
        tagsRepositoryMock.lockSpaceForTagWrites,
      ).toHaveBeenCalledExactlyOnceWith(entityManager, spaceId);
      expect(repositoryMock.upsertMany).toHaveBeenCalledExactlyOnceWith({
        userId: Number(authPayload.sub),
        spaceId,
        addressBookItems: payload,
        entityManager,
      });
      expect(
        tagsRepositoryMock.setTagsForItems,
      ).toHaveBeenCalledExactlyOnceWith({
        userId: Number(authPayload.sub),
        spaceId,
        entries: [{ address: tagged.address, tags }],
        entityManager,
      });
      expect(tagsRepositoryMock.lockSpaceForTagWrites).toHaveBeenCalledBefore(
        repositoryMock.upsertMany,
      );
      expect(repositoryMock.upsertMany).toHaveBeenCalledBefore(
        tagsRepositoryMock.setTagsForItems,
      );
    });

    it('should throw a 403 when the caller is not an admin', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.upsertMany(authPayload, spaceId, { items: [] }),
      ).rejects.toThrow(
        new HttpExceptionNoLog(
          'User is not an admin of this workspace',
          HttpStatus.FORBIDDEN,
        ),
      );
      expect(repositoryMock.upsertMany).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for unauthenticated user', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload();

      await expect(
        service.upsertMany(authPayload, spaceId, { items: [] }),
      ).rejects.toThrow(UnauthorizedException);
      expect(membersRepositoryMock.findOne).not.toHaveBeenCalled();
      expect(repositoryMock.upsertMany).not.toHaveBeenCalled();
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
    ] as const)('should delete for %s admin', async (_label, builder) => {
      const spaceId = faker.number.int();
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayload = new AuthPayload(builder().build());
      repositoryMock.deleteByAddress.mockResolvedValue();

      await service.deleteByAddress({ authPayload, spaceId, address });

      expect(membersRepositoryMock.findOne).toHaveBeenCalledWith({
        user: { id: Number(authPayload.sub) },
        space: { id: spaceId },
        status: 'ACTIVE',
        role: 'ADMIN',
      });
      expect(repositoryMock.deleteByAddress).toHaveBeenCalledWith({
        userId: Number(authPayload.sub),
        spaceId,
        address,
      });
    });

    it('should throw a 403 when the caller is not an admin', async () => {
      const spaceId = faker.number.int();
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.deleteByAddress({ authPayload, spaceId, address }),
      ).rejects.toThrow(
        new HttpExceptionNoLog(
          'User is not an admin of this workspace',
          HttpStatus.FORBIDDEN,
        ),
      );
      expect(repositoryMock.deleteByAddress).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for unauthenticated user', async () => {
      const spaceId = faker.number.int();
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayload = new AuthPayload();

      await expect(
        service.deleteByAddress({ authPayload, spaceId, address }),
      ).rejects.toThrow(UnauthorizedException);
      expect(membersRepositoryMock.findOne).not.toHaveBeenCalled();
      expect(repositoryMock.deleteByAddress).not.toHaveBeenCalled();
    });
  });

  describe('setContactTags', () => {
    it('should set the tags for an active MEMBER and return the address book', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const item = addressBookItemBuilder().build();
      const tags = faker.helpers.multiple(
        () => addressBookTagBuilder().build(),
        {
          count: { min: 1, max: 3 },
        },
      );
      const items = [
        { address: item.address, tags: tags.map((tag) => tag.name) },
      ];
      membersRepositoryMock.findOne.mockResolvedValue(
        memberBuilder().with('role', 'MEMBER').with('status', 'ACTIVE').build(),
      );
      repositoryMock.findAllBySpaceId.mockResolvedValue([item]);
      tagsRepositoryMock.findBySpaceId.mockResolvedValue({
        tags,
        itemTagIds: new Map([[item.id, tags.map((tag) => tag.id)]]),
      });

      const result = await service.setContactTags(authPayload, spaceId, {
        items,
      });

      expect(membersRepositoryMock.findOne).toHaveBeenCalledWith({
        user: { id: Number(authPayload.sub) },
        space: { id: spaceId },
        status: 'ACTIVE',
      });
      expect(
        tagsRepositoryMock.setTagsForItems,
      ).toHaveBeenCalledExactlyOnceWith({
        userId: Number(authPayload.sub),
        spaceId,
        entries: items,
      });
      expect(result.tags).toEqual(tags);
      expect(result.data).toEqual([
        expect.objectContaining({
          address: item.address,
          tagIds: tags.map((tag) => tag.id),
        }),
      ]);
    });

    it('should throw a 403 when the caller is not an active member', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.setContactTags(authPayload, spaceId, {
          items: [
            {
              address: getAddress(faker.finance.ethereumAddress()),
              tags: [faker.word.noun()],
            },
          ],
        }),
      ).rejects.toThrow(
        new HttpExceptionNoLog(
          'User is not a member of this workspace',
          HttpStatus.FORBIDDEN,
        ),
      );
      expect(tagsRepositoryMock.setTagsForItems).not.toHaveBeenCalled();
    });

    it('should reject a batch larger than the address book limit', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const items = faker.helpers.multiple(
        (): { address: Address; tags: Array<string> } => ({
          address: getAddress(faker.finance.ethereumAddress()),
          tags: [faker.word.noun()],
        }),
        { count: MAX_ADDRESS_BOOK_ITEMS + 1 },
      );

      await expect(
        service.setContactTags(authPayload, spaceId, { items }),
      ).rejects.toThrow(
        new BadRequestException(
          `A tag update can change at most ${MAX_ADDRESS_BOOK_ITEMS} contacts.`,
        ),
      );
      expect(tagsRepositoryMock.setTagsForItems).not.toHaveBeenCalled();
    });

    it('should answer a non-member with 403, not the batch limit', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);
      const items = faker.helpers.multiple(
        (): { address: Address; tags: Array<string> } => ({
          address: getAddress(faker.finance.ethereumAddress()),
          tags: [faker.word.noun()],
        }),
        { count: MAX_ADDRESS_BOOK_ITEMS + 1 },
      );

      await expect(
        service.setContactTags(authPayload, spaceId, { items }),
      ).rejects.toThrow(
        new HttpExceptionNoLog(
          'User is not a member of this workspace',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should accept a batch of exactly the address book limit', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const items = faker.helpers.multiple(
        (): { address: Address; tags: Array<string> } => ({
          address: getAddress(faker.finance.ethereumAddress()),
          tags: [faker.word.noun()],
        }),
        { count: MAX_ADDRESS_BOOK_ITEMS },
      );
      repositoryMock.findAllBySpaceId.mockResolvedValue([]);

      await service.setContactTags(authPayload, spaceId, { items });

      expect(
        tagsRepositoryMock.setTagsForItems,
      ).toHaveBeenCalledExactlyOnceWith({
        userId: Number(authPayload.sub),
        spaceId,
        entries: items,
      });
    });

    it('should throw UnauthorizedException for unauthenticated user', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload();

      await expect(
        service.setContactTags(authPayload, spaceId, { items: [] }),
      ).rejects.toThrow(UnauthorizedException);
      expect(membersRepositoryMock.findOne).not.toHaveBeenCalled();
      expect(tagsRepositoryMock.setTagsForItems).not.toHaveBeenCalled();
    });
  });

  describe('createTag', () => {
    it('should create the tag for an active MEMBER and return the address book', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const tag = addressBookTagBuilder().with('contactCount', 0).build();
      membersRepositoryMock.findOne.mockResolvedValue(
        memberBuilder().with('role', 'MEMBER').with('status', 'ACTIVE').build(),
      );
      repositoryMock.findAllBySpaceId.mockResolvedValue([]);
      tagsRepositoryMock.findBySpaceId.mockResolvedValue({
        tags: [tag],
        itemTagIds: new Map(),
      });

      const result = await service.createTag({
        authPayload,
        spaceId,
        dto: { name: tag.name },
      });

      expect(tagsRepositoryMock.createTag).toHaveBeenCalledExactlyOnceWith({
        userId: Number(authPayload.sub),
        spaceId,
        name: tag.name,
      });
      expect(result.tags).toEqual([tag]);
    });

    it('should throw a 403 when the caller is not an active member', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.createTag({
          authPayload,
          spaceId: faker.number.int(),
          dto: { name: faker.word.noun() },
        }),
      ).rejects.toThrow(
        new HttpExceptionNoLog(
          'User is not a member of this workspace',
          HttpStatus.FORBIDDEN,
        ),
      );
      expect(tagsRepositoryMock.createTag).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for unauthenticated user', async () => {
      await expect(
        service.createTag({
          authPayload: new AuthPayload(),
          spaceId: faker.number.int(),
          dto: { name: faker.word.noun() },
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(tagsRepositoryMock.createTag).not.toHaveBeenCalled();
    });
  });

  describe('renameTag', () => {
    it('should rename the tag for an active MEMBER and return the address book', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const tag = addressBookTagBuilder().build();
      const name = faker.word.noun();
      membersRepositoryMock.findOne.mockResolvedValue(
        memberBuilder().with('role', 'MEMBER').with('status', 'ACTIVE').build(),
      );
      repositoryMock.findAllBySpaceId.mockResolvedValue([]);
      tagsRepositoryMock.findBySpaceId.mockResolvedValue({
        tags: [{ ...tag, name }],
        itemTagIds: new Map(),
      });

      const result = await service.renameTag({
        authPayload,
        spaceId,
        tagId: tag.id,
        dto: { name },
      });

      expect(tagsRepositoryMock.renameTag).toHaveBeenCalledExactlyOnceWith({
        userId: Number(authPayload.sub),
        spaceId,
        tagId: tag.id,
        name,
      });
      expect(result.tags).toEqual([{ ...tag, name }]);
    });

    it('should throw a 403 when the caller is not an active member', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.renameTag({
          authPayload,
          spaceId,
          tagId: faker.number.int(),
          dto: { name: faker.word.noun() },
        }),
      ).rejects.toThrow(
        new HttpExceptionNoLog(
          'User is not a member of this workspace',
          HttpStatus.FORBIDDEN,
        ),
      );
      expect(tagsRepositoryMock.renameTag).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for unauthenticated user', async () => {
      const authPayload = new AuthPayload();

      await expect(
        service.renameTag({
          authPayload,
          spaceId: faker.number.int(),
          tagId: faker.number.int(),
          dto: { name: faker.word.noun() },
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(membersRepositoryMock.findOne).not.toHaveBeenCalled();
      expect(tagsRepositoryMock.renameTag).not.toHaveBeenCalled();
    });
  });

  describe('deleteTag', () => {
    it('should delete the tag for an active MEMBER', async () => {
      const spaceId = faker.number.int();
      const tagId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(
        memberBuilder().with('role', 'MEMBER').with('status', 'ACTIVE').build(),
      );

      await service.deleteTag({ authPayload, spaceId, tagId });

      expect(tagsRepositoryMock.deleteTag).toHaveBeenCalledExactlyOnceWith({
        userId: Number(authPayload.sub),
        spaceId,
        tagId,
      });
    });

    it('should throw a 403 when the caller is not an active member', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.deleteTag({
          authPayload,
          spaceId: faker.number.int(),
          tagId: faker.number.int(),
        }),
      ).rejects.toThrow(
        new HttpExceptionNoLog(
          'User is not a member of this workspace',
          HttpStatus.FORBIDDEN,
        ),
      );
      expect(tagsRepositoryMock.deleteTag).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for unauthenticated user', async () => {
      const authPayload = new AuthPayload();

      await expect(
        service.deleteTag({
          authPayload,
          spaceId: faker.number.int(),
          tagId: faker.number.int(),
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(membersRepositoryMock.findOne).not.toHaveBeenCalled();
      expect(tagsRepositoryMock.deleteTag).not.toHaveBeenCalled();
    });
  });
});
