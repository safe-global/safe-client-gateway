// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type postgres from 'postgres';
import request from 'supertest';
import { getAddress } from 'viem';
import { TestDbFactory } from '@/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import {
  TEST_WRAPPED_INDEX_KEY,
  TestKmsModule,
} from '@/datasources/kms/__tests__/test.kms.module';
import { KmsModule } from '@/datasources/kms/kms.module';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';

/**
 * What field encryption puts in the table, from the route down. The write path
 * splits encrypting from inserting, and `PreparedSpaceSafe` carries both the
 * ciphertext and the plaintext the audit event needs, so only a test that
 * reads the column can tell the two apart.
 *
 * KMS is doubled at the AWS boundary (`TestKmsModule`); the envelope
 * encryption, the blind index and the repository are real.
 */
describe('Safe address encryption', () => {
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
    spaceUuid: string;
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

  async function addSafe(
    spaceUuid: string,
    accessToken: string,
    safe: { chainId: string; address: `0x${string}` },
  ): Promise<request.Response> {
    return await request(app.getHttpServer())
      .post(`/v1/spaces/${spaceUuid}/safes`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ safes: [safe] });
  }

  it('stores the address encrypted and reads it back in plaintext', async () => {
    const { accessToken, spaceUuid } = await createSpaceForSigner();
    const safe = {
      chainId: '1',
      address: getAddress(faker.finance.ethereumAddress()),
    };

    await addSafe(spaceUuid, accessToken, safe).then((response) =>
      expect(response.status).toBe(201),
    );

    const spaceSafeRepository =
      await postgresDatabaseService.getRepository(SpaceSafe);
    const [row] = await spaceSafeRepository.find();
    expect(row.address).toMatch(/^kms:v1:/);
    expect(row.address).not.toContain(safe.address);
    // Equality lookups and the unique index run on this, not on the value.
    expect(row.addressIndex).not.toBeNull();

    // The round trip: encrypting and decrypting wrongly would cancel out if
    // only one direction were asserted.
    const response = await request(app.getHttpServer())
      .get(`/v1/spaces/${spaceUuid}/safes`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200);
    expect(response.body).toStrictEqual({ safes: { 1: [safe.address] } });
  });

  it('rejects the same Safe twice, matching on the blind index', async () => {
    const { accessToken, spaceUuid } = await createSpaceForSigner();
    const safe = {
      chainId: '1',
      address: getAddress(faker.finance.ethereumAddress()),
    };
    await addSafe(spaceUuid, accessToken, safe);

    // Ciphertext is non-deterministic, so the second attempt only collides if
    // uniqueness is enforced on the blind index.
    const duplicate = await addSafe(spaceUuid, accessToken, safe);

    expect(duplicate.status).toBe(409);
  });
});
