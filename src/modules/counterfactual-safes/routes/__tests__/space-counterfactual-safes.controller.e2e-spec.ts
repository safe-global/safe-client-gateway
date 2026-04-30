// SPDX-License-Identifier: FSL-1.1-MIT
import { type Server } from 'http';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { SpaceCounterfactualSafesController } from '@/modules/counterfactual-safes/routes/space-counterfactual-safes.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { counterfactualSafeBuilder } from '@/modules/counterfactual-safes/datasources/entities/__tests__/counterfactual-safe.entity.db.builder';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { createTestModule } from '@/__tests__/testing-module';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';

function buildCounterfactualSafe(chainId?: string): Record<string, unknown> {
  const cfSafe = counterfactualSafeBuilder()
    .with('chainId', chainId ?? chainBuilder().build().chainId)
    .build();
  return {
    chainId: cfSafe.chainId,
    address: cfSafe.address,
    factoryAddress: cfSafe.factoryAddress,
    masterCopy: cfSafe.masterCopy,
    saltNonce: cfSafe.saltNonce,
    safeVersion: cfSafe.safeVersion,
    threshold: cfSafe.threshold,
    owners: cfSafe.owners,
    fallbackHandler: cfSafe.fallbackHandler,
    to: cfSafe.setupTo,
    data: cfSafe.setupData,
    paymentToken: cfSafe.paymentToken,
    payment: cfSafe.payment,
    paymentReceiver: cfSafe.paymentReceiver,
  };
}

describe('SpaceCounterfactualSafesController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;

  beforeAll(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        users: true,
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      overridePostgresV2: false,
      guards: [
        {
          originalGuard: SpacesCreationRateLimitGuard,
          testGuard: {
            canActivate: (): true => true,
          },
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

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should require authentication for every endpoint', () => {
    const endpoints = Object.values(
      SpaceCounterfactualSafesController.prototype,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    ) as Array<Function>;

    endpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
  });

  describe('GET /v1/spaces/:spaceId/counterfactual-safes', () => {
    it('Should return counterfactual safes for a space', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain = chainBuilder().build();
      const cfSafe = buildCounterfactualSafe(chain.chainId);

      // Create user + space
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const spaceRes = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: nameBuilder() });
      const spaceId = spaceRes.body.id as number;

      // Create counterfactual safe
      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [cfSafe] })
        .expect(201);

      // Add the safe to the space
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: cfSafe.chainId,
              address: cfSafe.address,
            },
          ],
        })
        .expect(201);

      // Get space counterfactual safes
      const getResponse = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(getResponse.body.safes).toBeDefined();
      expect(getResponse.body.safes[chain.chainId]).toHaveLength(1);
      expect(getResponse.body.safes[chain.chainId][0]).toMatchObject({
        address: cfSafe.address,
      });
    });

    it('Should return empty safes for a space with no counterfactual safes', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const spaceRes = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: nameBuilder() });
      const spaceId = spaceRes.body.id as number;

      const getResponse = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(getResponse.body.safes).toEqual({});
    });

    it('Should return 403 for a non-member', async () => {
      const authPayloadDto1 = siweAuthPayloadDtoBuilder().build();
      const accessToken1 = jwtService.sign(authPayloadDto1);
      const authPayloadDto2 = siweAuthPayloadDtoBuilder().build();
      const accessToken2 = jwtService.sign(authPayloadDto2);

      // User 1 creates a space
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken1}`]);

      const spaceRes = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken1}`])
        .send({ name: nameBuilder() });
      const spaceId = spaceRes.body.id as number;

      // User 2 tries to access
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken2}`]);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken2}`])
        .expect(403);
    });

    it('Should return 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .get(`/v1/spaces/1/counterfactual-safes`)
        .expect(403);
    });

    it('Should only return safes that are both in the space and counterfactual', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain = chainBuilder().build();
      const cfSafe = buildCounterfactualSafe(chain.chainId);
      const deployedAddress = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const spaceRes = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: nameBuilder() });
      const spaceId = spaceRes.body.id as number;

      // Create counterfactual safe
      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [cfSafe] })
        .expect(201);

      // Add both the counterfactual safe AND a deployed safe to the space
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            { chainId: cfSafe.chainId, address: cfSafe.address },
            { chainId: chain.chainId, address: deployedAddress },
          ],
        })
        .expect(201);

      const getResponse = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      // Only the counterfactual safe should be returned (the deployed one
      // has no entry in counterfactual_safes table)
      const allSafes = Object.values(
        getResponse.body.safes as Record<string, Array<unknown>>,
      ).flat();
      expect(allSafes).toHaveLength(1);
      expect(allSafes[0]).toMatchObject({
        address: cfSafe.address,
      });
    });
  });
});
