// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
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
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { materializedSubscriptionBuilder } from '@/modules/entitlements/domain/entities/__tests__/materialized-subscription.builder';
import { QUOTA_EXCEEDED_ERROR_CODE } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';

/**
 * The seat limit end to end: the route, its guard, the real entitlements
 * service and the real repository against a real database. Every other spec
 * fakes one half of this — the repository's own tests invent a seat rule, and
 * the entitlements specs stub the Safe count — so this is the only place that
 * proves a Safe cannot be added above the quota.
 */
describe('Safe seat enforcement', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let postgresDatabaseService: PostgresDatabaseService;
  let entitlementsService: EntitlementsService;

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
        // Off on purpose: enforcement must not need the billing integration,
        // which is why `SubscriptionSyncModule` is separate.
        billingService: false,
      },
      entitlements: {
        ...defaultConfiguration.entitlements,
        // Enforcing: the point of this suite is what the plan decides.
        enforcementStartsAt: faker.date.past(),
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
      ],
    });

    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    postgresDatabaseService = moduleFixture.get(PostgresDatabaseService);
    entitlementsService = moduleFixture.get(EntitlementsService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  /** Registers a user and the space they administer, as a client would. */
  async function createSpaceForSigner(): Promise<{
    accessToken: string;
    spaceUuid: string;
    spaceId: number;
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

    const spaceRepository = await postgresDatabaseService.getRepository(Space);
    const space = await spaceRepository.findOneOrFail({
      where: { uuid: spaceResponse.body.uuid },
      select: { id: true },
    });

    return {
      accessToken,
      spaceUuid: spaceResponse.body.uuid,
      spaceId: space.id,
    };
  }

  /** A plan granting `quota` Safe seats, materialized as a webhook would. */
  async function grantSeats(spaceId: number, quota: number): Promise<void> {
    await entitlementsService.materializeFromEvent({
      spaceId,
      subscription: materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('entitlements', [
          { featureKey: 'safe_seats', enabled: true, quota, value: null },
        ])
        .build(),
      eventAt: new Date(),
    });
  }

  function safePayload(count: number): Array<{
    chainId: string;
    address: `0x${string}`;
  }> {
    return faker.helpers.multiple(
      () => ({
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      }),
      { count },
    );
  }

  async function addSafes(
    spaceUuid: string,
    accessToken: string,
    count: number,
  ): Promise<request.Response> {
    return await request(app.getHttpServer())
      .post(`/v1/spaces/${spaceUuid}/safes`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ safes: safePayload(count) });
  }

  async function countSafes(spaceId: number): Promise<number> {
    const repository = await postgresDatabaseService.getRepository(SpaceSafe);
    return await repository.count({ where: { space: { id: spaceId } } });
  }

  it('rejects the first Safe when the plan grants no seats', async () => {
    const { accessToken, spaceUuid, spaceId } = await createSpaceForSigner();

    const response = await addSafes(spaceUuid, accessToken, 1);

    expect(response.status).toBe(HttpStatus.PAYMENT_REQUIRED);
    expect(response.body).toMatchObject({
      code: QUOTA_EXCEEDED_ERROR_CODE,
      feature: 'safe_seats',
      quota: 0,
      used: 0,
    });
    await expect(countSafes(spaceId)).resolves.toBe(0);
  });

  it('admits Safes up to the purchased quota and rejects the next one', async () => {
    const { accessToken, spaceUuid, spaceId } = await createSpaceForSigner();
    await grantSeats(spaceId, 2);

    await expect(addSafes(spaceUuid, accessToken, 1)).resolves.toMatchObject({
      status: HttpStatus.CREATED,
    });
    await expect(addSafes(spaceUuid, accessToken, 1)).resolves.toMatchObject({
      status: HttpStatus.CREATED,
    });

    const rejected = await addSafes(spaceUuid, accessToken, 1);

    expect(rejected.status).toBe(HttpStatus.PAYMENT_REQUIRED);
    expect(rejected.body).toMatchObject({ quota: 2, used: 2 });
    await expect(countSafes(spaceId)).resolves.toBe(2);
  });

  it('rejects a batch that would overshoot the quota, writing nothing', async () => {
    const { accessToken, spaceUuid, spaceId } = await createSpaceForSigner();
    await grantSeats(spaceId, 2);

    // The guard admits this (nothing used yet); the check inside the write is
    // what sees the batch size.
    const response = await addSafes(spaceUuid, accessToken, 3);

    expect(response.status).toBe(HttpStatus.PAYMENT_REQUIRED);
    expect(response.body).toMatchObject({ quota: 2, used: 0 });
    await expect(countSafes(spaceId)).resolves.toBe(0);
  });
});
