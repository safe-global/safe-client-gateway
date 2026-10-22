// SPDX-License-Identifier: FSL-1.1-MIT

import type { UUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import configuration from '#/config/entities/__tests__/configuration';
import { postgresConfig } from '#/config/entities/postgres.config';
import { DatabaseMigrator } from '#/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { DB_MAX_SAFE_INTEGER } from '#/domain/common/constants';
import { nameBuilder } from '#/domain/common/entities/name.builder';
import type { ILoggingService } from '#/logging/logging.interface';
import { AddressBookItem } from '#/modules/spaces/datasources/address-books/entities/address-book-item.entity.db';
import { AddressBookItemTag } from '#/modules/spaces/datasources/address-books/entities/address-book-item-tag.entity.db';
import { AddressBookTag } from '#/modules/spaces/datasources/address-books/entities/address-book-tag.entity.db';
import { SpaceSafe } from '#/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import { createMockSpaceEncryptionService } from '#/modules/spaces/domain/__tests__/space-encryption.service.mock';
import { AddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository';
import type { IAddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { AddressBookTagsRepository } from '#/modules/spaces/domain/address-books/address-book-tags.repository';
import type { IAddressBookTagsRepository } from '#/modules/spaces/domain/address-books/address-book-tags.repository.interface';
import { addressBookItemBuilder } from '#/modules/spaces/domain/address-books/entities/__tests__/address-book-item.db.builder';
import { addressBookItemTagDbBuilder } from '#/modules/spaces/domain/address-books/entities/__tests__/address-book-item-tag.db.builder';
import { addressBookTagDbBuilder } from '#/modules/spaces/domain/address-books/entities/__tests__/address-book-tag.db.builder';
import {
  type AddressBookTag as DomainAddressBookTag,
  TAG_COLORS,
  TAG_NAME_TAKEN_MESSAGE,
  type TagColor,
  WORKSPACE_TAG_LIMIT_MESSAGE,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import { createMockSpaceAuditRepository } from '#/modules/spaces/domain/audit/__tests__/space-audit.repository.mock';
import { SpaceAuditEventType } from '#/modules/spaces/domain/audit/entities/space-audit-event.entity';
import type { SpaceAuditRecordArgs } from '#/modules/spaces/domain/audit/space-audit.repository.interface';
import { spaceBuilder } from '#/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import { SpacesRepository } from '#/modules/spaces/domain/spaces.repository';
import { Member } from '#/modules/users/datasources/entities/member.entity.db';
import { User } from '#/modules/users/datasources/entities/users.entity.db';
import { createMockMemberEncryptionService } from '#/modules/users/domain/members/__tests__/member-encryption.service.mock';
import { Wallet } from '#/modules/wallets/datasources/entities/wallets.entity.db';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

/**
 * Holds every party at `arrive()` until `parties` of them have arrived. Run
 * each party through `party()`: if one fails before arriving, every waiting
 * `arrive()` rejects with its error, so the real error surfaces instead of the
 * others waiting forever.
 */
function createBarrier(parties: number): {
  arrive: () => Promise<void>;
  party: <T>(run: () => Promise<T>) => Promise<T>;
} {
  let arrived = 0;
  const released = Promise.withResolvers<void>();
  // A party can fail before any other awaits the release.
  released.promise.catch(() => undefined);
  return {
    arrive: (): Promise<void> => {
      arrived += 1;
      if (arrived === parties) {
        released.resolve();
      }
      return released.promise;
    },
    party: async <T>(run: () => Promise<T>): Promise<T> => {
      try {
        return await run();
      } catch (error) {
        // No-op once released: only a party failing before then frees others.
        released.reject(error);
        throw error;
      }
    },
  };
}

function rejectionsOf(
  results: Array<PromiseSettledResult<void>>,
): Array<unknown> {
  return results.flatMap((result) =>
    result.status === 'rejected' ? [result.reason] : [],
  );
}

function capitalise(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** Distinct (case-insensitively) tag names. */
function tagNames(count: number): Array<string> {
  return faker.helpers.uniqueArray(
    () => faker.string.alpha({ length: { min: 3, max: 20 }, casing: 'lower' }),
    count,
  );
}

/**
 * How long the two-connection pool lets a query wait for a free connection.
 * Short, so a query that leaves its transaction for the pool fails the test
 * fast instead of hanging it.
 */
const POOL_CHECKOUT_TIMEOUT_MS = 2_000;
/** Backstop for the tests on the two-connection pool. */
const TWO_CONNECTION_TEST_TIMEOUT_MS = 5_000;

describe('AddressBookTagsRepository', () => {
  let dbService: PostgresDatabaseService;
  let addressBookItemsRepository: IAddressBookItemsRepository;
  let addressBookTagsRepository: IAddressBookTagsRepository;
  let twoConnectionDbService: PostgresDatabaseService;
  let twoConnection: {
    db: PostgresDatabaseService;
    itemsRepository: IAddressBookItemsRepository;
    tagsRepository: IAddressBookTagsRepository;
  };
  // Own doubles, so assertions see only the tag repository's calls.
  const tagsAuditRepository = createMockSpaceAuditRepository();
  const tagsEncryptionService = createMockSpaceEncryptionService();

  const testDatabaseName = faker.string.alpha({
    length: 10,
    casing: 'lower',
  });
  const testConfiguration = configuration();

  const dataSourceOptions = {
    ...postgresConfig({
      ...testConfiguration.db.connection.postgres,
      type: 'postgres',
      database: testDatabaseName,
    }),
    migrationsTableName: testConfiguration.db.orm.migrationsTableName,
    entities: [
      Member,
      Space,
      SpaceSafe,
      User,
      Wallet,
      AddressBookItem,
      AddressBookTag,
      AddressBookItemTag,
    ],
  };
  const dataSource = new DataSource(dataSourceOptions);
  // One connection per transaction of a two-transaction test and none spare:
  // a query that takes a pooled connection while its transaction holds the
  // tag lock waits on a full pool, and fails after POOL_CHECKOUT_TIMEOUT_MS.
  const twoConnectionDataSource = new DataSource({
    ...dataSourceOptions,
    poolSize: 2,
    connectTimeoutMS: POOL_CHECKOUT_TIMEOUT_MS,
  });

  const dbUserRepo = dataSource.getRepository(User);
  const dbSpacesRepository = dataSource.getRepository(Space);
  const dbMembersRepository = dataSource.getRepository(Member);
  const dbTagsRepository = dataSource.getRepository(AddressBookTag);
  const dbItemTagsRepository = dataSource.getRepository(AddressBookItemTag);

  beforeAll(async () => {
    // Create database
    const testDataSource = new DataSource({
      ...postgresConfig({
        ...testConfiguration.db.connection.postgres,
        type: 'postgres',
        database: 'postgres',
      }),
    });

    const testDbService = new PostgresDatabaseService(
      mockLoggingService,
      testDataSource,
    );
    await testDbService.initializeDatabaseConnection();
    await testDbService
      .getDataSource()
      .query(`CREATE DATABASE ${testDatabaseName}`);
    await testDbService.destroyDatabaseConnection();

    // Create database connection
    dbService = new PostgresDatabaseService(mockLoggingService, dataSource);
    await dbService.initializeDatabaseConnection();

    // Migrate database. The migrator takes Nest's ConfigService, which
    // FakeConfigurationService does not implement.
    const mockConfigService = {
      getOrThrow: vi.fn().mockImplementation((key: string) => {
        if (key === 'db.migrator.numberOfRetries') {
          return testConfiguration.db.migrator.numberOfRetries;
        }
        if (key === 'db.migrator.retryAfterMs') {
          return testConfiguration.db.migrator.retryAfterMs;
        }
      }),
    } as MockedObject<ConfigService>;
    const migrator = new DatabaseMigrator(
      mockLoggingService,
      dbService,
      mockConfigService,
    );
    await migrator.migrate();

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'spaces.maxSpaceCreationsPerUser',
      testConfiguration.spaces.maxSpaceCreationsPerUser,
    );
    fakeConfigurationService.set(
      'spaces.addressBooks.maxItems',
      testConfiguration.spaces.addressBooks.maxItems,
    );

    const createRepositories = (
      db: PostgresDatabaseService,
    ): {
      itemsRepository: IAddressBookItemsRepository;
      tagsRepository: IAddressBookTagsRepository;
    } => {
      const itemsRepository = new AddressBookItemsRepository(
        db,
        new SpacesRepository(
          db,
          fakeConfigurationService,
          createMockSpaceAuditRepository(),
          createMockSpaceEncryptionService(),
          createMockMemberEncryptionService(),
        ),
        fakeConfigurationService,
        createMockSpaceAuditRepository(),
        createMockSpaceEncryptionService(),
      );
      const tagsRepository = new AddressBookTagsRepository(
        db,
        itemsRepository,
        tagsAuditRepository,
        tagsEncryptionService,
      );
      return { itemsRepository, tagsRepository };
    };

    const repositories = createRepositories(dbService);
    addressBookItemsRepository = repositories.itemsRepository;
    addressBookTagsRepository = repositories.tagsRepository;

    twoConnectionDbService = new PostgresDatabaseService(
      mockLoggingService,
      twoConnectionDataSource,
    );
    await twoConnectionDbService.initializeDatabaseConnection();
    twoConnection = {
      db: twoConnectionDbService,
      ...createRepositories(twoConnectionDbService),
    };
  });

  afterAll(async () => {
    await twoConnectionDbService.destroyDatabaseConnection();
    await dbService.getDataSource().dropDatabase();
    await dbService.destroyDatabaseConnection();
  });

  describe('setTagsForItems', () => {
    it('creates tags on first use with distinct colours and assigns them', async () => {
      const { spaceId, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });
      const names = tagNames(3);

      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [{ address, tags: names }],
      });

      const { tags, itemTagIds } =
        await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags.map((tag) => tag.name).sort()).toStrictEqual(
        [...names].sort(),
      );
      const colors = tags.map((tag) => tag.color);
      expect(new Set(colors).size).toBe(3);
      expect(TAG_COLORS).toEqual(expect.arrayContaining(colors));
      expect(tags.map((tag) => tag.contactCount)).toStrictEqual([1, 1, 1]);
      const itemId = await findItemId(spaceId, address);
      expect(itemTagIds.get(itemId)?.sort()).toStrictEqual(
        tags.map((tag) => tag.id).sort(),
      );
    });

    it('reuses an existing tag regardless of case and keeps its first spelling', async () => {
      const { spaceId, userId } = await createSpace();
      const [first, second] = await createContacts({
        spaceId,
        userId,
        count: 2,
      });
      const [lower] = tagNames(1);
      const capitalised = capitalise(lower);

      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [{ address: first, tags: [capitalised] }],
      });
      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [{ address: second, tags: [lower.toUpperCase()] }],
      });

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toStrictEqual([
        expect.objectContaining({ name: capitalised, contactCount: 2 }),
      ]);
      await expect(tagNamesOf(spaceId, first)).resolves.toStrictEqual(
        new Set([capitalised]),
      );
      await expect(tagNamesOf(spaceId, second)).resolves.toStrictEqual(
        new Set([capitalised]),
      );
    });

    it('rejects a 9th tag in the space with WORKSPACE_TAG_LIMIT_MESSAGE and changes nothing', async () => {
      const { spaceId, userId } = await createSpace();
      const [first, second, third] = await createContacts({
        spaceId,
        userId,
        count: 3,
      });
      const names = tagNames(9);
      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [
          { address: first, tags: names.slice(0, 3) },
          { address: second, tags: names.slice(3, 6) },
          { address: third, tags: names.slice(6, 8) },
        ],
      });

      await expect(
        addressBookTagsRepository.setTagsForItems({
          userId,
          spaceId,
          entries: [{ address: first, tags: [names[8]] }],
        }),
      ).rejects.toThrow(new BadRequestException(WORKSPACE_TAG_LIMIT_MESSAGE));

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toHaveLength(8);
      await expect(tagNamesOf(spaceId, first)).resolves.toStrictEqual(
        new Set(names.slice(0, 3)),
      );
    });

    it('creates exactly one tag when two requests add the same new name concurrently', async () => {
      const { spaceId, userId } = await createSpace();
      const [first, second] = await createContacts({
        spaceId,
        userId,
        count: 2,
      });
      const [name] = tagNames(1);

      const results = await inOverlappingTransactions(
        [first, second],
        (address, entityManager) =>
          addressBookTagsRepository.setTagsForItems({
            userId,
            spaceId,
            entries: [{ address, tags: [name] }],
            entityManager,
          }),
      );

      expect(rejectionsOf(results)).toStrictEqual([]);

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toStrictEqual([
        expect.objectContaining({ name, contactCount: 2 }),
      ]);
      await expect(tagNamesOf(spaceId, first)).resolves.toStrictEqual(
        new Set([name]),
      );
      await expect(tagNamesOf(spaceId, second)).resolves.toStrictEqual(
        new Set([name]),
      );
    });

    it('never gives two tags the same colour under concurrent creates', async () => {
      const { spaceId, userId } = await createSpace();
      const addresses = await createContacts({
        spaceId,
        userId,
        count: TAG_COLORS.length,
      });
      const names = tagNames(TAG_COLORS.length);

      const results = await inOverlappingTransactions(
        addresses.map((address, index) => ({ address, name: names[index] })),
        ({ address, name }, entityManager) =>
          addressBookTagsRepository.setTagsForItems({
            userId,
            spaceId,
            entries: [{ address, tags: [name] }],
            entityManager,
          }),
      );

      expect(rejectionsOf(results)).toStrictEqual([]);
      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toHaveLength(TAG_COLORS.length);
      expect(new Set(tags.map((tag) => tag.color))).toStrictEqual(
        new Set(TAG_COLORS),
      );
    });

    it('creates exactly one 8th tag when two requests race for the last slot', async () => {
      const { spaceId, userId } = await createSpace();
      const [first, second, third, a, b] = await createContacts({
        spaceId,
        userId,
        count: 5,
      });
      const names = tagNames(9);
      const existing = names.slice(0, 7);
      const [x, y] = names.slice(7);
      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [
          { address: first, tags: existing.slice(0, 3) },
          { address: second, tags: existing.slice(3, 6) },
          { address: third, tags: existing.slice(6, 7) },
        ],
      });

      const results = await inOverlappingTransactions(
        [
          { address: a, name: x },
          { address: b, name: y },
        ],
        ({ address, name }, entityManager) =>
          addressBookTagsRepository.setTagsForItems({
            userId,
            spaceId,
            entries: [{ address, tags: [name] }],
            entityManager,
          }),
      );

      // The loser gets the limit message, never a unique violation (500).
      expect(rejectionsOf(results)).toStrictEqual([
        new BadRequestException(WORKSPACE_TAG_LIMIT_MESSAGE),
      ]);
      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(new Set(tags.map((tag) => tag.color))).toStrictEqual(
        new Set(TAG_COLORS),
      );
      const created = tags
        .map((tag) => tag.name)
        .filter((name) => !existing.includes(name));
      expect(created).toHaveLength(1);
      expect([x, y]).toContain(created[0]);
      const tagsOfRacers = new Set([
        ...(await tagNamesOf(spaceId, a)),
        ...(await tagNamesOf(spaceId, b)),
      ]);
      expect(tagsOfRacers).toStrictEqual(new Set(created));
    });

    it('creates one tag for spellings of the same new name across the items of one request', async () => {
      const { spaceId, userId } = await createSpace();
      const [a, b, c] = await createContacts({ spaceId, userId, count: 3 });
      const [lower] = tagNames(1);
      const capitalised = capitalise(lower);

      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [
          { address: a, tags: [capitalised] },
          { address: b, tags: [` ${lower}`] },
          { address: c, tags: [lower.toUpperCase()] },
        ],
      });

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toStrictEqual([
        expect.objectContaining({ name: capitalised, contactCount: 3 }),
      ]);
      for (const address of [a, b, c]) {
        await expect(tagNamesOf(spaceId, address)).resolves.toStrictEqual(
          new Set([capitalised]),
        );
      }
    });

    it("replacing a contact's tags with [] removes the associations but keeps the tags", async () => {
      const { spaceId, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });
      const names = tagNames(2);
      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [{ address, tags: names }],
      });

      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [{ address, tags: [] }],
      });

      await expect(tagNamesOf(spaceId, address)).resolves.toStrictEqual(
        new Set(),
      );
      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toHaveLength(2);
      expect(tags.map((tag) => tag.contactCount)).toStrictEqual([0, 0]);
    });

    it('decrypts the tag names of the space once per write, however many contacts change', async () => {
      const { spaceId, userId } = await createSpace();
      const addresses = await createContacts({ spaceId, userId, count: 3 });
      const names = tagNames(4);
      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: addresses.map((address, index) => ({
          address,
          tags: [names[index]],
        })),
      });
      tagsEncryptionService.decryptTagNames.mockClear();
      tagsEncryptionService.encryptTagName.mockClear();

      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: addresses.map((address) => ({ address, tags: [names[3]] })),
      });

      expect(tagsEncryptionService.decryptTagNames).toHaveBeenCalledTimes(1);
      expect(
        tagsEncryptionService.encryptTagName,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, names[3]);
      // Names of both loaded and newly created tags come from the name map.
      expect(tagsAuditRepository.record).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          payload: {
            address: addresses[2],
            oldTags: [names[2]],
            newTags: [names[3]],
          },
        }),
      );
    });

    it('records ADDRESS_BOOK_TAGS_UPDATED only when the set changed', async () => {
      const { spaceId, spaceUuid, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });
      const names = tagNames(2);

      for (const _ of [1, 2]) {
        await addressBookTagsRepository.setTagsForItems({
          userId,
          spaceId,
          entries: [{ address, tags: names }],
        });
      }

      expect(tagsAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        {
          spaceId,
          spaceUuid,
          actorUserId: userId,
          eventType: SpaceAuditEventType.ADDRESS_BOOK_TAGS_UPDATED,
          payload: { address, oldTags: [], newTags: names },
        },
      );
    });

    it('records one ADDRESS_BOOK_TAGS_UPDATED per changed contact of a batch and none for an unchanged one', async () => {
      const { spaceId, spaceUuid, userId } = await createSpace();
      const [unchanged, retagged, cleared] = await createContacts({
        spaceId,
        userId,
        count: 3,
      });
      const [kept, before, after] = tagNames(3);
      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [
          { address: unchanged, tags: [kept] },
          { address: retagged, tags: [before] },
          { address: cleared, tags: [kept, before] },
        ],
      });
      tagsAuditRepository.record.mockClear();

      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [
          { address: unchanged, tags: [kept] },
          { address: retagged, tags: [after] },
          { address: cleared, tags: [] },
        ],
      });

      const event = (
        address: Address,
        oldTags: Array<string>,
        newTags: Array<string>,
      ): SpaceAuditRecordArgs => ({
        spaceId,
        spaceUuid,
        actorUserId: userId,
        eventType: SpaceAuditEventType.ADDRESS_BOOK_TAGS_UPDATED,
        payload: { address, oldTags, newTags },
      });
      expect(tagsAuditRepository.record).toHaveBeenCalledTimes(2);
      expect(tagsAuditRepository.record).toHaveBeenCalledWith(
        expect.anything(),
        event(retagged, [before], [after]),
      );
      expect(tagsAuditRepository.record).toHaveBeenCalledWith(
        expect.anything(),
        event(cleared, [kept, before], []),
      );
      await expect(tagNamesOf(spaceId, unchanged)).resolves.toStrictEqual(
        new Set([kept]),
      );
      await expect(tagNamesOf(spaceId, retagged)).resolves.toStrictEqual(
        new Set([after]),
      );
      await expect(tagNamesOf(spaceId, cleared)).resolves.toStrictEqual(
        new Set(),
      );
    });

    it('gives a repeated address the tags of its last item, with one audit event against the stored set', async () => {
      const { spaceId, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });
      const [stored, first, last] = tagNames(3);
      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [{ address, tags: [stored] }],
      });
      tagsAuditRepository.record.mockClear();

      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [
          { address, tags: [first] },
          { address, tags: [last] },
        ],
      });

      await expect(tagNamesOf(spaceId, address)).resolves.toStrictEqual(
        new Set([last]),
      );
      expect(tagsAuditRepository.record).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        expect.objectContaining({
          payload: { address, oldTags: [stored], newTags: [last] },
        }),
      );
    });

    it('fails a batch only after every audit record has settled, and changes no contact', async () => {
      const { spaceId, userId } = await createSpace();
      const [first, second] = await createContacts({
        spaceId,
        userId,
        count: 2,
      });
      const error = new Error(faker.lorem.sentence());
      let releaseSecondRecord = (): void => {};
      const secondRecord = new Promise<void>((resolve) => {
        releaseSecondRecord = resolve;
      });
      tagsAuditRepository.record
        .mockRejectedValueOnce(error)
        .mockReturnValueOnce(secondRecord);

      let settled = false;
      const outcome = addressBookTagsRepository
        .setTagsForItems({
          userId,
          spaceId,
          entries: [
            { address: first, tags: tagNames(1) },
            { address: second, tags: tagNames(1) },
          ],
        })
        .then(
          () => {
            settled = true;
          },
          (reason: unknown) => {
            settled = true;
            return reason;
          },
        );
      await vi.waitFor(() =>
        expect(tagsAuditRepository.record).toHaveBeenCalledTimes(2),
      );
      // Failing here, with the second record still in flight, would roll the
      // transaction back under it.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(settled).toBe(false);

      releaseSecondRecord();
      await expect(outcome).resolves.toBe(error);
      await expect(tagNamesOf(spaceId, first)).resolves.toStrictEqual(
        new Set(),
      );
      await expect(tagNamesOf(spaceId, second)).resolves.toStrictEqual(
        new Set(),
      );
      await expect(countTagsOfSpace(spaceId)).resolves.toBe(0);
    });

    it('throws NotFoundException for an address that is not in the book', async () => {
      const { spaceId, userId } = await createSpace();

      await expect(
        addressBookTagsRepository.setTagsForItems({
          userId,
          spaceId,
          entries: [
            {
              address: getAddress(faker.finance.ethereumAddress()),
              tags: tagNames(1),
            },
          ],
        }),
      ).rejects.toThrow(new NotFoundException('Address book item not found.'));
    });

    it('changes no contact when one item of a batch names an unknown address', async () => {
      const { spaceId, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });

      await expect(
        addressBookTagsRepository.setTagsForItems({
          userId,
          spaceId,
          entries: [
            { address, tags: tagNames(1) },
            {
              address: getAddress(faker.finance.ethereumAddress()),
              tags: tagNames(1),
            },
          ],
        }),
      ).rejects.toThrow(new NotFoundException('Address book item not found.'));

      await expect(tagNamesOf(spaceId, address)).resolves.toStrictEqual(
        new Set(),
      );
      await expect(countTagsOfSpace(spaceId)).resolves.toBe(0);
      expect(tagsAuditRepository.record).not.toHaveBeenCalled();
    });

    it('changes no contact when a batch would create a 9th tag', async () => {
      const { spaceId, userId } = await createSpace();
      const [first, second, third, a, b] = await createContacts({
        spaceId,
        userId,
        count: 5,
      });
      // 7 tags; A and B each hold one of them.
      const existing = tagNames(7);
      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [
          { address: first, tags: existing.slice(0, 3) },
          { address: second, tags: existing.slice(3, 6) },
          { address: third, tags: existing.slice(6, 7) },
          { address: a, tags: [existing[0]] },
          { address: b, tags: [existing[3]] },
        ],
      });
      const [x, y, z] = tagNames(3);

      await expect(
        addressBookTagsRepository.setTagsForItems({
          userId,
          spaceId,
          entries: [
            { address: a, tags: [x] },
            { address: b, tags: [y, z] },
          ],
        }),
      ).rejects.toThrow(new BadRequestException(WORKSPACE_TAG_LIMIT_MESSAGE));

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags.map((tag) => tag.name).sort()).toStrictEqual(
        [...existing].sort(),
      );
      await expect(tagNamesOf(spaceId, a)).resolves.toStrictEqual(
        new Set([existing[0]]),
      );
      await expect(tagNamesOf(spaceId, b)).resolves.toStrictEqual(
        new Set([existing[3]]),
      );
    });

    it('does not deadlock when two transactions insert contacts and then set tags', async () => {
      const { spaceId, userId } = await createSpace();
      const contacts = faker.helpers.multiple(
        () => addressBookItemBuilder().build(),
        { count: 2 },
      );
      const names = tagNames(4);
      const namesOf = [names.slice(0, 2), names.slice(2, 4)];
      // Both transactions must hold FOR KEY SHARE on the spaces row (taken by
      // the FK check of their contact insert) before either asks for the tag
      // lock; Promise.all alone does not guarantee that interleaving.
      const barrier = createBarrier(2);

      await Promise.all(
        contacts.map((contact, index) =>
          barrier.party(() =>
            dbService.transaction(async (entityManager) => {
              await addressBookItemsRepository.upsertMany({
                userId,
                spaceId,
                addressBookItems: [contact],
                entityManager,
              });
              await barrier.arrive();
              await addressBookTagsRepository.setTagsForItems({
                userId,
                spaceId,
                entries: [{ address: contact.address, tags: namesOf[index] }],
                entityManager,
              });
            }),
          ),
        ),
      );

      for (const [index, contact] of contacts.entries()) {
        await expect(
          tagNamesOf(spaceId, contact.address),
        ).resolves.toStrictEqual(new Set(namesOf[index]));
      }
    });

    it(
      'serialises admin upserts that take the tag lock first, on a pool with no spare connection',
      async () => {
        // Each transaction holds one of the pool's two connections, the second
        // one blocked on the lock. A query of the first that left its
        // transaction for the pool would wait on the full pool for good (in
        // production: nine waiters on the lock hold the other connections).
        const { db, itemsRepository, tagsRepository } = twoConnection;
        const { spaceId, userId } = await createSpace();
        const [first, second] = faker.helpers.multiple(
          () => addressBookItemBuilder().build(),
          { count: 2 },
        );
        const [shared, ownOfFirst, ownOfSecond] = tagNames(3);
        // One-sided latch, no barrier: the second transaction asks for the lock
        // only once the first holds it, then blocks on it; the first never
        // waits on the second, so nothing can hang.
        const firstHoldsLock = Promise.withResolvers<void>();
        firstHoldsLock.promise.catch(() => undefined);
        const adminUpsert = async (
          entityManager: EntityManager,
          contact: AddressBookItem,
          tags: Array<string>,
        ): Promise<void> => {
          await itemsRepository.upsertMany({
            userId,
            spaceId,
            addressBookItems: [contact],
            entityManager,
          });
          await tagsRepository.setTagsForItems({
            userId,
            spaceId,
            entries: [{ address: contact.address, tags }],
            entityManager,
          });
        };

        await Promise.all([
          db
            .transaction(async (entityManager) => {
              await tagsRepository.lockSpaceForTagWrites(
                entityManager,
                spaceId,
              );
              firstHoldsLock.resolve();
              await adminUpsert(entityManager, first, [shared, ownOfFirst]);
            })
            .catch((error: unknown) => {
              // Never leave the second transaction waiting on the latch.
              firstHoldsLock.reject(error);
              throw error;
            }),
          db.transaction(async (entityManager) => {
            await firstHoldsLock.promise;
            await tagsRepository.lockSpaceForTagWrites(entityManager, spaceId);
            await adminUpsert(entityManager, second, [shared, ownOfSecond]);
          }),
        ]);

        await expect(tagNamesOf(spaceId, first.address)).resolves.toStrictEqual(
          new Set([shared, ownOfFirst]),
        );
        await expect(
          tagNamesOf(spaceId, second.address),
        ).resolves.toStrictEqual(new Set([shared, ownOfSecond]));
        await expect(countTagsOfSpace(spaceId)).resolves.toBe(3);
      },
      TWO_CONNECTION_TEST_TIMEOUT_MS,
    );
  });

  describe('findBySpaceId', () => {
    it('lists the tags of the space with their contact counts and which contact has which, and nothing of another space', async () => {
      const { spaceId, userId } = await createSpace();
      const other = await createSpace();
      const [alice, bob] = await createContacts({ spaceId, userId, count: 2 });
      const [stranger] = await createContacts({
        spaceId: other.spaceId,
        userId: other.userId,
        count: 1,
      });
      const [aliceId, bobId, strangerId] = await Promise.all([
        findItemId(spaceId, alice),
        findItemId(spaceId, bob),
        findItemId(other.spaceId, stranger),
      ]);
      const [sharedName, soloName, foreignName] = tagNames(3);
      const [sharedColor, soloColor] = faker.helpers.arrayElements(
        TAG_COLORS,
        2,
      );
      const shared = await insertTagRow({
        spaceId,
        name: sharedName,
        color: sharedColor,
      });
      const solo = await insertTagRow({
        spaceId,
        name: soloName,
        color: soloColor,
      });
      const foreign = await insertTagRow({
        spaceId: other.spaceId,
        name: foreignName,
        color: faker.helpers.arrayElement(TAG_COLORS),
      });
      await dbItemTagsRepository.insert(
        [
          [aliceId, shared],
          [bobId, shared],
          [aliceId, solo],
          [strangerId, foreign],
        ].map(([itemId, tagId]) =>
          addressBookItemTagDbBuilder()
            .with('itemId', itemId)
            .with('tagId', tagId)
            .build(),
        ),
      );

      const { tags, itemTagIds } =
        await addressBookTagsRepository.findBySpaceId(spaceId);

      expect(tags).toHaveLength(2);
      expect(tags).toEqual(
        expect.arrayContaining([
          { id: shared, name: sharedName, color: sharedColor, contactCount: 2 },
          { id: solo, name: soloName, color: soloColor, contactCount: 1 },
        ]),
      );
      expect(new Set(itemTagIds.get(aliceId))).toStrictEqual(
        new Set([shared, solo]),
      );
      expect(itemTagIds.get(bobId)).toStrictEqual([shared]);
      expect(itemTagIds.has(strangerId)).toBe(false);
    });
  });

  describe('lockSpaceForTagWrites', () => {
    it('returns the id and uuid of the space', async () => {
      const { spaceId, spaceUuid } = await createSpace();

      await expect(
        dbService.transaction((entityManager) =>
          addressBookTagsRepository.lockSpaceForTagWrites(
            entityManager,
            spaceId,
          ),
        ),
      ).resolves.toStrictEqual({ id: spaceId, uuid: spaceUuid });
    });

    it('throws NotFoundException for a space that does not exist', async () => {
      await expect(
        dbService.transaction((entityManager) =>
          addressBookTagsRepository.lockSpaceForTagWrites(
            entityManager,
            faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }),
          ),
        ),
      ).rejects.toThrow(new NotFoundException('Workspace not found.'));
    });
  });

  describe('createTag', () => {
    it('creates a tag with no contacts in an unused colour and records it', async () => {
      const { spaceId, spaceUuid, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });
      const [existing, name] = tagNames(2);
      const existingTag = await createTag({
        spaceId,
        userId,
        address,
        name: existing,
      });

      await addressBookTagsRepository.createTag({ userId, spaceId, name });

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      const created = tags.find((tag) => tag.name === name);
      expect(created).toEqual(expect.objectContaining({ contactCount: 0 }));
      expect(TAG_COLORS).toContain(created?.color);
      expect(created?.color).not.toBe(existingTag.color);
      expect(tagsAuditRepository.record).toHaveBeenLastCalledWith(
        expect.anything(),
        {
          spaceId,
          spaceUuid,
          actorUserId: userId,
          eventType: SpaceAuditEventType.ADDRESS_BOOK_TAG_CREATED,
          payload: { name, color: created?.color },
        },
      );
    });

    it('rejects a name the space already has, ignoring case, and creates nothing', async () => {
      const { spaceId, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });
      const [name] = tagNames(1);
      await createTag({ spaceId, userId, address, name });
      tagsAuditRepository.record.mockClear();

      await expect(
        addressBookTagsRepository.createTag({
          userId,
          spaceId,
          name: name.toUpperCase(),
        }),
      ).rejects.toThrow(new ConflictException(TAG_NAME_TAKEN_MESSAGE));

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toHaveLength(1);
      expect(tagsAuditRepository.record).not.toHaveBeenCalled();
    });

    it('rejects a 9th tag in the space with WORKSPACE_TAG_LIMIT_MESSAGE', async () => {
      const { spaceId, userId } = await createSpace();
      const names = tagNames(9);
      for (const name of names.slice(0, 8)) {
        await addressBookTagsRepository.createTag({ userId, spaceId, name });
      }

      await expect(
        addressBookTagsRepository.createTag({
          userId,
          spaceId,
          name: names[8],
        }),
      ).rejects.toThrow(new BadRequestException(WORKSPACE_TAG_LIMIT_MESSAGE));

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toHaveLength(8);
      expect(new Set(tags.map((tag) => tag.color)).size).toBe(8);
    });

    it('throws NotFoundException for a space that does not exist', async () => {
      const { userId } = await createSpace();

      await expect(
        addressBookTagsRepository.createTag({
          userId,
          spaceId: DB_MAX_SAFE_INTEGER,
          name: tagNames(1)[0],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('renameTag', () => {
    it('renames a tag and keeps its colour', async () => {
      const { spaceId, spaceUuid, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });
      const [oldName, newName] = tagNames(2);
      const tag = await createTag({ spaceId, userId, address, name: oldName });

      await addressBookTagsRepository.renameTag({
        userId,
        spaceId,
        tagId: tag.id,
        name: newName,
      });

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toStrictEqual([
        { id: tag.id, name: newName, color: tag.color, contactCount: 1 },
      ]);
      expect(tagsAuditRepository.record).toHaveBeenLastCalledWith(
        expect.anything(),
        {
          spaceId,
          spaceUuid,
          actorUserId: userId,
          eventType: SpaceAuditEventType.ADDRESS_BOOK_TAG_RENAMED,
          payload: { oldName, newName, merged: false },
        },
      );
    });

    it('changes only the spelling when renaming to another case of its own name', async () => {
      const { spaceId, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });
      const [name] = tagNames(1);
      const tag = await createTag({ spaceId, userId, address, name });

      await addressBookTagsRepository.renameTag({
        userId,
        spaceId,
        tagId: tag.id,
        name: name.toUpperCase(),
      });

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toStrictEqual([
        {
          id: tag.id,
          name: name.toUpperCase(),
          color: tag.color,
          contactCount: 1,
        },
      ]);
    });

    it('records nothing when renaming a tag to its current name', async () => {
      const { spaceId, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });
      const [name] = tagNames(1);
      const tag = await createTag({ spaceId, userId, address, name });

      await addressBookTagsRepository.renameTag({
        userId,
        spaceId,
        tagId: tag.id,
        name,
      });

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toStrictEqual([tag]);
      expect(tagsAuditRepository.record).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: SpaceAuditEventType.ADDRESS_BOOK_TAG_RENAMED,
        }),
      );
    });

    it('merges into an existing tag on rename, deduplicating contacts that had both', async () => {
      const { spaceId, spaceUuid, userId } = await createSpace();
      const [a, b] = await createContacts({ spaceId, userId, count: 2 });
      const [x, y] = tagNames(2);
      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [
          { address: a, tags: [x, y] },
          { address: b, tags: [x] },
        ],
      });
      const before = await addressBookTagsRepository.findBySpaceId(spaceId);
      const tagX = findTagByName(before.tags, x);
      const tagY = findTagByName(before.tags, y);

      await addressBookTagsRepository.renameTag({
        userId,
        spaceId,
        tagId: tagX.id,
        name: y.toUpperCase(),
      });

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toStrictEqual([
        { id: tagY.id, name: y, color: tagY.color, contactCount: 2 },
      ]);
      await expect(tagNamesOf(spaceId, a)).resolves.toStrictEqual(new Set([y]));
      await expect(tagNamesOf(spaceId, b)).resolves.toStrictEqual(new Set([y]));
      await expect(dbTagsRepository.existsBy({ id: tagX.id })).resolves.toBe(
        false,
      );
      expect(tagsAuditRepository.record).toHaveBeenLastCalledWith(
        expect.anything(),
        {
          spaceId,
          spaceUuid,
          actorUserId: userId,
          eventType: SpaceAuditEventType.ADDRESS_BOOK_TAG_RENAMED,
          payload: { oldName: x, newName: y, merged: true },
        },
      );
    });

    it('rejects renaming a tag of another space with NotFoundException', async () => {
      const { spaceId: spaceIdA, userId } = await createSpace();
      const spaceB = await createSpace();
      const [address] = await createContacts({
        spaceId: spaceB.spaceId,
        userId: spaceB.userId,
        count: 1,
      });
      const [name, newName] = tagNames(2);
      const tag = await createTag({
        spaceId: spaceB.spaceId,
        userId: spaceB.userId,
        address,
        name,
      });

      await expect(
        addressBookTagsRepository.renameTag({
          userId,
          spaceId: spaceIdA,
          tagId: tag.id,
          name: newName,
        }),
      ).rejects.toThrow(new NotFoundException('Tag not found.'));

      const { tags } = await addressBookTagsRepository.findBySpaceId(
        spaceB.spaceId,
      );
      expect(tags).toStrictEqual([tag]);
      expect(tagsAuditRepository.record).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: SpaceAuditEventType.ADDRESS_BOOK_TAG_RENAMED,
        }),
      );
    });
  });

  describe('deleteTag', () => {
    it('deletes a tag, removes it from every contact and records contactCount', async () => {
      const { spaceId, spaceUuid, userId } = await createSpace();
      const [a, b] = await createContacts({ spaceId, userId, count: 2 });
      const [name, kept] = tagNames(2);
      await addressBookTagsRepository.setTagsForItems({
        userId,
        spaceId,
        entries: [
          { address: a, tags: [name, kept] },
          { address: b, tags: [name] },
        ],
      });
      const before = await addressBookTagsRepository.findBySpaceId(spaceId);
      const tag = findTagByName(before.tags, name);

      await addressBookTagsRepository.deleteTag({
        userId,
        spaceId,
        tagId: tag.id,
      });

      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags.map((t) => t.name)).toStrictEqual([kept]);
      await expect(tagNamesOf(spaceId, a)).resolves.toStrictEqual(
        new Set([kept]),
      );
      await expect(tagNamesOf(spaceId, b)).resolves.toStrictEqual(new Set());
      await expect(
        dbItemTagsRepository.countBy({ tagId: tag.id }),
      ).resolves.toBe(0);
      expect(tagsAuditRepository.record).toHaveBeenLastCalledWith(
        expect.anything(),
        {
          spaceId,
          spaceUuid,
          actorUserId: userId,
          eventType: SpaceAuditEventType.ADDRESS_BOOK_TAG_DELETED,
          payload: { name, contactCount: 2 },
        },
      );
    });

    it('rejects deleting a tag of another space with NotFoundException', async () => {
      const { spaceId: spaceIdA, userId } = await createSpace();
      const spaceB = await createSpace();
      const [address] = await createContacts({
        spaceId: spaceB.spaceId,
        userId: spaceB.userId,
        count: 1,
      });
      const [name] = tagNames(1);
      const tag = await createTag({
        spaceId: spaceB.spaceId,
        userId: spaceB.userId,
        address,
        name,
      });

      await expect(
        addressBookTagsRepository.deleteTag({
          userId,
          spaceId: spaceIdA,
          tagId: tag.id,
        }),
      ).rejects.toThrow(new NotFoundException('Tag not found.'));

      const { tags } = await addressBookTagsRepository.findBySpaceId(
        spaceB.spaceId,
      );
      expect(tags).toStrictEqual([tag]);
      expect(tagsAuditRepository.record).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: SpaceAuditEventType.ADDRESS_BOOK_TAG_DELETED,
        }),
      );
    });
  });

  describe('contact deletion', () => {
    it("drops a contact's associations when the contact is deleted", async () => {
      const { spaceId, userId } = await createSpace();
      const [address] = await createContacts({ spaceId, userId, count: 1 });
      const [name] = tagNames(1);
      const tag = await createTag({ spaceId, userId, address, name });
      const itemId = await findItemId(spaceId, address);

      await addressBookItemsRepository.deleteByAddress({
        userId,
        spaceId,
        address,
      });

      await expect(dbItemTagsRepository.countBy({ itemId })).resolves.toBe(0);
      const { tags } = await addressBookTagsRepository.findBySpaceId(spaceId);
      expect(tags).toStrictEqual([{ ...tag, contactCount: 0 }]);
    });
  });

  // Utility functions

  /**
   * Runs `work` once per input, each in its own transaction, released only
   * once every transaction is open: two writes then really overlap instead of
   * the second still waiting for a pool connection while the first commits.
   *
   * @returns every transaction's outcome, in input order.
   */
  const inOverlappingTransactions = async <T>(
    inputs: Array<T>,
    work: (input: T, entityManager: EntityManager) => Promise<void>,
  ): Promise<Array<PromiseSettledResult<void>>> => {
    const barrier = createBarrier(inputs.length);
    return await Promise.allSettled(
      inputs.map((input) =>
        barrier.party(() =>
          dbService.transaction(async (entityManager) => {
            await barrier.arrive();
            await work(input, entityManager);
          }),
        ),
      ),
    );
  };

  const createSpace = async (): Promise<{
    spaceId: number;
    spaceUuid: UUID;
    userId: number;
  }> => {
    const user = await dbUserRepo.insert({ status: 'ACTIVE' });
    const space = await dbSpacesRepository.insert({
      name: nameBuilder(),
      status: 'ACTIVE',
    });
    await dbMembersRepository.insert({
      user: user.generatedMaps[0],
      space: space.generatedMaps[0],
      name: nameBuilder(),
      status: 'ACTIVE',
      role: 'ADMIN',
      invitedBy: null,
    });
    return {
      spaceId: space.generatedMaps[0].id as number,
      spaceUuid: space.generatedMaps[0].uuid as UUID,
      userId: user.generatedMaps[0].id as number,
    };
  };

  /** Adds `count` contacts through the real repository; returns their addresses. */
  const createContacts = async (args: {
    spaceId: number;
    userId: number;
    count: number;
  }): Promise<Array<Address>> => {
    const items = faker.helpers.multiple(
      () => addressBookItemBuilder().build(),
      { count: args.count },
    );
    await addressBookItemsRepository.upsertMany({
      userId: args.userId,
      spaceId: args.spaceId,
      addressBookItems: items,
    });
    return items.map((item) => item.address);
  };

  /** Tags `address` with a new tag `name`; returns the tag as listed. */
  const createTag = async (args: {
    spaceId: number;
    userId: number;
    address: Address;
    name: string;
  }): Promise<DomainAddressBookTag> => {
    await addressBookTagsRepository.setTagsForItems({
      userId: args.userId,
      spaceId: args.spaceId,
      entries: [{ address: args.address, tags: [args.name] }],
    });
    const { tags } = await addressBookTagsRepository.findBySpaceId(
      args.spaceId,
    );
    return findTagByName(tags, args.name);
  };

  /** Inserts a tag row straight into the table, bypassing the repository; returns its id. */
  const insertTagRow = async (args: {
    spaceId: number;
    name: string;
    color: TagColor;
  }): Promise<number> => {
    const tag = addressBookTagDbBuilder()
      .with('space', spaceBuilder().with('id', args.spaceId).build())
      .with('name', args.name)
      .with('nameIndex', `${args.spaceId}:${args.name.toLowerCase()}`)
      .with('color', args.color)
      .build();
    await dbTagsRepository.insert(tag);
    return tag.id;
  };

  const findTagByName = (
    tags: Array<DomainAddressBookTag>,
    name: string,
  ): DomainAddressBookTag => {
    const tag = tags.find((candidate) => candidate.name === name);
    if (!tag) {
      throw new Error(`Tag ${name} not found`);
    }
    return tag;
  };

  const findItemId = async (
    spaceId: number,
    address: Address,
  ): Promise<number> => {
    const itemIds = await addressBookItemsRepository.findItemIdsByAddresses({
      spaceId,
      addresses: [address],
    });
    const itemId = itemIds.get(address.toLowerCase());
    if (itemId === undefined) {
      throw new Error(`Contact ${address} not found`);
    }
    return itemId;
  };

  const tagNamesOf = async (
    spaceId: number,
    address: Address,
  ): Promise<Set<string>> => {
    const itemId = await findItemId(spaceId, address);
    const { tags, itemTagIds } =
      await addressBookTagsRepository.findBySpaceId(spaceId);
    const tagIds = new Set(itemTagIds.get(itemId) ?? []);
    return new Set(
      tags.filter((tag) => tagIds.has(tag.id)).map((tag) => tag.name),
    );
  };

  const countTagsOfSpace = (spaceId: number): Promise<number> =>
    dbTagsRepository.countBy({ space: { id: spaceId } });
});
