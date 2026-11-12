// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type postgres from 'postgres';
import request from 'supertest';
import { TestDbFactory } from '#/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import { IJwtService } from '#/datasources/jwt/jwt.service.interface';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { NotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/test.notification.repository.module';
import { spaceSetupSafeBuilder } from '#/modules/spaces/domain/setup/entities/__tests__/space-setup.builder';
import { createSpaceSetupDtoBuilder } from '#/modules/spaces/routes/entities/__tests__/create-space-setup.dto.builder';
import type { CreateSpaceSetupDto } from '#/modules/spaces/routes/entities/space-setup.dto.entity';
import { SpacesCreationRateLimitGuard } from '#/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';

/**
 * The Workspace setup on a deployment without the billing service
 * (`FF_BILLING_SERVICE` off): the app boots with the special-case billing,
 * a setup without a plan applies at once, and one with a plan is refused.
 */
describe('Workspace setup without billing', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let postLoginRedirectUri: string;

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
      entitlements: {
        ...defaultConfiguration.entitlements,
        // Past: without billing, enforcement must not demand a plan.
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
    postLoginRedirectUri = moduleFixture
      .get<IConfigurationService>(IConfigurationService)
      .getOrThrow('auth.postLoginRedirectUri');

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  async function signIn(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [
        `access_token=${jwtService.sign(siweAuthPayloadDtoBuilder().build())}`,
      ])
      .expect(201);
    return jwtService.sign(
      siweAuthPayloadDtoBuilder().with('sub', String(response.body.id)).build(),
    );
  }

  function setupBody(paymentLinkId: string | null): CreateSpaceSetupDto {
    return createSpaceSetupDtoBuilder()
      .with('paymentLinkId', paymentLinkId)
      .with('safes', [spaceSetupSafeBuilder().with('chainId', '1').build()])
      .with('returnUrl', new URL('/welcome', postLoginRedirectUri).toString())
      .build();
  }

  async function listSpaces(accessToken: string): Promise<request.Response> {
    return await request(app.getHttpServer())
      .get('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200);
  }

  it('applies a setup without a plan at once', async () => {
    const accessToken = await signIn();

    const { body: created } = await request(app.getHttpServer())
      .post('/v1/spaces/setup')
      .set('Cookie', [`access_token=${accessToken}`])
      .send(setupBody(null))
      .expect(201);

    expect(created).toEqual({
      spaceId: expect.any(String),
      checkoutUrl: null,
    });
    const { body: spaces } = await listSpaces(accessToken);
    expect(spaces).toEqual([
      expect.objectContaining({
        uuid: created.spaceId,
        setupStatus: 'applied',
      }),
    ]);
  });

  it('refuses a setup with a plan, and writes nothing', async () => {
    const accessToken = await signIn();

    const response = await request(app.getHttpServer())
      .post('/v1/spaces/setup')
      .set('Cookie', [`access_token=${accessToken}`])
      .send(setupBody(faker.string.alphanumeric(16)))
      .expect(422);

    expect(response.body).toEqual(
      expect.objectContaining({ message: 'Billing is not available' }),
    );
    const { body: spaces } = await listSpaces(accessToken);
    expect(spaces).toEqual([]);
  });

  it('has no trial-plans route', async () => {
    const accessToken = await signIn();

    await request(app.getHttpServer())
      .get('/v1/billing/trial-plans')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(404);
  });
});
