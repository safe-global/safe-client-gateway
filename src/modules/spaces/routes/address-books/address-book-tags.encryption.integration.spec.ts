// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID, type UUID } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type postgres from 'postgres';
import request from 'supertest';
import { getAddress } from 'viem';
import { TestDbFactory } from '#/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import configuration from '#/config/entities/__tests__/configuration';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { IJwtService } from '#/datasources/jwt/jwt.service.interface';
import {
  TEST_WRAPPED_INDEX_KEY,
  TestKmsModule,
} from '#/datasources/kms/__tests__/test.kms.module';
import { KmsModule } from '#/datasources/kms/kms.module';
import { nameBuilder } from '#/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { NotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/test.notification.repository.module';
import { AddressBookTag } from '#/modules/spaces/datasources/address-books/entities/address-book-tag.entity.db';
import { SpacesCreationRateLimitGuard } from '#/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';

/**
 * What field encryption does to tags, from the route down. KMS is doubled at
 * the AWS boundary (`TestKmsModule`); the envelope encryption, the blind index
 * and the repositories are real.
 */
describe('Address book tags encryption', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let postgresDatabaseService: PostgresDatabaseService;

  const testDatabaseName = `test_${randomUUID().replaceAll('-', '')}`;
  const testDbFactory = new TestDbFactory();
  let testDatabase: postgres.Sql;

  beforeAll(async () => {
    testDatabase = await testDbFactory.createTestDatabase(testDatabaseName);

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      db: {
        ...defaultConfiguration.db,
        connection: {
          ...defaultConfiguration.db.connection,
          postgres: {
            ...defaultConfiguration.db.connection.postgres,
            database: testDatabaseName,
          },
        },
      },
      features: {
        ...defaultConfiguration.features,
        auth: true,
        users: true,
        billingService: false,
      },
      encryption: {
        ...defaultConfiguration.encryption,
        enabled: true,
        indexKey: TEST_WRAPPED_INDEX_KEY,
        kms: { ...defaultConfiguration.encryption.kms, keyId: 'test-key' },
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      overridePostgresV2: false,
      cacheKeyPrefix: testDatabaseName,
      guards: [
        {
          originalGuard: SpacesCreationRateLimitGuard,
          testGuard: { canActivate: (): true => true },
        },
      ],
      modules: [
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
        { originalModule: KmsModule, testModule: TestKmsModule },
      ],
    });

    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    postgresDatabaseService = moduleFixture.get(PostgresDatabaseService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  async function createSpaceForSigner(): Promise<{
    accessToken: string;
    spaceUuid: UUID;
  }> {
    const walletResponse = await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [
        `access_token=${jwtService.sign(siweAuthPayloadDtoBuilder().build())}`,
      ])
      .expect(201);
    const accessToken = jwtService.sign(
      siweAuthPayloadDtoBuilder()
        .with('sub', String(walletResponse.body.id))
        .build(),
    );
    const spaceResponse = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ name: nameBuilder() })
      .expect(201);

    return { accessToken, spaceUuid: spaceResponse.body.uuid };
  }

  function buildContact(tags?: Array<string>): {
    name: string;
    address: `0x${string}`;
    chainIds: Array<string>;
    tags?: Array<string>;
  } {
    return {
      name: nameBuilder(),
      address: getAddress(faker.finance.ethereumAddress()),
      chainIds: ['1'],
      ...(tags && { tags }),
    };
  }

  function buildTagName(): string {
    return faker.string.alpha({ length: { min: 8, max: 16 } });
  }

  async function putAddressBook(
    spaceUuid: string,
    accessToken: string,
    items: Array<ReturnType<typeof buildContact>>,
  ): Promise<request.Response> {
    return await request(app.getHttpServer())
      .put(`/v1/spaces/${spaceUuid}/address-book`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ items });
  }

  async function getAddressBook(
    spaceUuid: string,
    accessToken: string,
  ): Promise<request.Response> {
    return await request(app.getHttpServer())
      .get(`/v1/spaces/${spaceUuid}/address-book`)
      .set('Cookie', [`access_token=${accessToken}`]);
  }

  async function findTagRows(spaceUuid: UUID): Promise<Array<AddressBookTag>> {
    const repository =
      await postgresDatabaseService.getRepository(AddressBookTag);
    return await repository.find({ where: { space: { uuid: spaceUuid } } });
  }

  it('stores the tag name encrypted and returns it in plaintext', async () => {
    const { accessToken, spaceUuid } = await createSpaceForSigner();
    const tagName = buildTagName();
    const contact = buildContact([tagName]);

    await putAddressBook(spaceUuid, accessToken, [contact]).then((response) =>
      expect(response.status).toBe(200),
    );

    const [row] = await findTagRows(spaceUuid);
    expect(row.name).toMatch(/^kms:v1:/);
    expect(row.name).not.toContain(tagName);
    // Lookups and the unique constraint run on the index, not on the name.
    expect(row.nameIndex).toBeTruthy();
    expect(row.nameIndex).not.toContain(tagName);
    expect(row.nameIndex).not.toContain(tagName.toLowerCase());

    // The round trip: encrypting and decrypting wrongly would cancel out if
    // only one direction were asserted.
    const response = await getAddressBook(spaceUuid, accessToken);
    expect(response.status).toBe(200);
    expect(response.body.tags).toStrictEqual([
      expect.objectContaining({
        id: row.id,
        name: tagName,
        contactCount: 1,
      }),
    ]);
    expect(response.body.data[0].tagIds).toStrictEqual([row.id]);
  });

  it('rejects the same name in another case, matching on the blind index', async () => {
    const { accessToken, spaceUuid } = await createSpaceForSigner();
    const tagName = buildTagName();
    const contactA = buildContact([tagName.toLowerCase()]);
    const contactB = buildContact([tagName.toUpperCase()]);

    await putAddressBook(spaceUuid, accessToken, [contactA]).then((response) =>
      expect(response.status).toBe(200),
    );
    await putAddressBook(spaceUuid, accessToken, [contactB]).then((response) =>
      expect(response.status).toBe(200),
    );

    // Ciphertext is non-deterministic, so the second name only resolves to the
    // existing tag if matching happens on the blind index.
    const rows = await findTagRows(spaceUuid);
    expect(rows).toHaveLength(1);
    const response = await getAddressBook(spaceUuid, accessToken);
    expect(response.body.tags).toStrictEqual([
      expect.objectContaining({ id: rows[0].id, contactCount: 2 }),
    ]);
    expect(
      response.body.data.map((item: { tagIds: Array<number> }) => item.tagIds),
    ).toStrictEqual([[rows[0].id], [rows[0].id]]);
  });

  it('gives the same name in two spaces different name_index values', async () => {
    const first = await createSpaceForSigner();
    const second = await createSpaceForSigner();
    const tagName = buildTagName();

    await putAddressBook(first.spaceUuid, first.accessToken, [
      buildContact([tagName]),
    ]).then((response) => expect(response.status).toBe(200));
    await putAddressBook(second.spaceUuid, second.accessToken, [
      buildContact([tagName]),
    ]).then((response) => expect(response.status).toBe(200));

    const [firstRow] = await findTagRows(first.spaceUuid);
    const [secondRow] = await findTagRows(second.spaceUuid);
    expect(firstRow.nameIndex).not.toBe(secondRow.nameIndex);
  });

  it('tags a contact stored with an HMAC address_index and 404s for an address not in the book', async () => {
    const { accessToken, spaceUuid } = await createSpaceForSigner();
    const contact = buildContact();
    const tagName = buildTagName();
    await putAddressBook(spaceUuid, accessToken, [contact]).then((response) =>
      expect(response.status).toBe(200),
    );

    const tagResponse = await request(app.getHttpServer())
      .put(`/v1/spaces/${spaceUuid}/address-book/tags`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ items: [{ address: contact.address, tags: [tagName] }] });

    expect(tagResponse.status).toBe(200);
    const [row] = await findTagRows(spaceUuid);
    const response = await getAddressBook(spaceUuid, accessToken);
    expect(response.body.tags).toStrictEqual([
      expect.objectContaining({ name: tagName, contactCount: 1 }),
    ]);
    expect(response.body.data).toStrictEqual([
      expect.objectContaining({ address: contact.address, tagIds: [row.id] }),
    ]);

    const missingResponse = await request(app.getHttpServer())
      .put(`/v1/spaces/${spaceUuid}/address-book/tags`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({
        items: [
          {
            address: getAddress(faker.finance.ethereumAddress()),
            tags: [buildTagName()],
          },
        ],
      });
    expect(missingResponse.status).toBe(404);
  });
});
