// SPDX-License-Identifier: FSL-1.1-MIT
import { type Server } from 'http';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { CounterfactualSafesController } from '@/modules/counterfactual-safes/routes/counterfactual-safes.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { counterfactualSafeBuilder } from '@/modules/counterfactual-safes/datasources/entities/__tests__/counterfactual-safe.entity.db.builder';
import { createTestModule } from '@/__tests__/testing-module';

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

describe('CounterfactualSafesController', () => {
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
      CounterfactualSafesController.prototype,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    ) as Array<Function>;

    endpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
  });

  describe('POST /v1/users/counterfactual-safes', () => {
    it('Should create a counterfactual safe', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const cfSafe = buildCounterfactualSafe();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [cfSafe] })
        .expect(201);
    });

    it('Should create multiple counterfactual safes', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const cfSafe1 = buildCounterfactualSafe();
      const cfSafe2 = buildCounterfactualSafe();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [cfSafe1, cfSafe2] })
        .expect(201);
    });

    it('Should be idempotent when the same user re-submits identical init params', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const cfSafe = buildCounterfactualSafe();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [cfSafe] })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [cfSafe] })
        .expect(201);
    });

    it('Should return 409 when (chainId, address) collides with different init params', async () => {
      const authPayloadDto1 = siweAuthPayloadDtoBuilder().build();
      const accessToken1 = jwtService.sign(authPayloadDto1);
      const authPayloadDto2 = siweAuthPayloadDtoBuilder().build();
      const accessToken2 = jwtService.sign(authPayloadDto2);
      const cfSafe = buildCounterfactualSafe();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken1}`]);
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken2}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken1}`])
        .send({ safes: [cfSafe] })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken2}`])
        .send({
          safes: [{ ...cfSafe, threshold: (cfSafe.threshold as number) + 1 }],
        })
        .expect(409);
    });

    it('Should allow a second user to attach to an existing counterfactual safe with matching init params', async () => {
      const authPayloadDto1 = siweAuthPayloadDtoBuilder().build();
      const accessToken1 = jwtService.sign(authPayloadDto1);
      const authPayloadDto2 = siweAuthPayloadDtoBuilder().build();
      const accessToken2 = jwtService.sign(authPayloadDto2);
      const cfSafe = buildCounterfactualSafe();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken1}`]);
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken2}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken1}`])
        .send({ safes: [cfSafe] })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken2}`])
        .send({ safes: [cfSafe] })
        .expect(201);

      const getResponse = await request(app.getHttpServer())
        .get('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken2}`])
        .expect(200);

      expect(getResponse.body.safes[cfSafe.chainId as string]).toHaveLength(1);
    });

    it('Should return 422 for invalid data (non-hex data field)', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const cfSafe = { ...buildCounterfactualSafe(), data: 'not-hex' };

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [cfSafe] })
        .expect(422);
    });

    it('Should return 422 for invalid saltNonce', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const cfSafe = {
        ...buildCounterfactualSafe(),
        saltNonce: 'not-numeric',
      };

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [cfSafe] })
        .expect(422);
    });

    it('Should return 422 for empty safes array', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [] })
        .expect(422);
    });

    it('Should return 403 if not authenticated', async () => {
      const cfSafe = buildCounterfactualSafe();

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .send({ safes: [cfSafe] })
        .expect(403);
    });
  });

  describe('GET /v1/users/counterfactual-safes', () => {
    it('Should return counterfactual safes grouped by chainId', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const cfSafe = buildCounterfactualSafe();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [cfSafe] })
        .expect(201);

      const getResponse = await request(app.getHttpServer())
        .get('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      const chainId = cfSafe.chainId as string;
      expect(getResponse.body.safes).toBeDefined();
      expect(getResponse.body.safes[chainId]).toBeDefined();
      expect(getResponse.body.safes[chainId]).toHaveLength(1);
      expect(getResponse.body.safes[chainId][0]).toMatchObject({
        address: cfSafe.address,
        factoryAddress: cfSafe.factoryAddress,
        masterCopy: cfSafe.masterCopy,
        saltNonce: cfSafe.saltNonce,
        safeVersion: cfSafe.safeVersion,
        threshold: cfSafe.threshold,
        owners: cfSafe.owners,
        fallbackHandler: cfSafe.fallbackHandler,
        to: cfSafe.to,
        data: cfSafe.data,
        paymentReceiver: cfSafe.paymentReceiver,
      });
    });

    it('Should return empty safes for a user with none', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const getResponse = await request(app.getHttpServer())
        .get('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(getResponse.body.safes).toEqual({});
    });

    it('Should not return safes created by another user', async () => {
      const authPayloadDto1 = siweAuthPayloadDtoBuilder().build();
      const accessToken1 = jwtService.sign(authPayloadDto1);
      const authPayloadDto2 = siweAuthPayloadDtoBuilder().build();
      const accessToken2 = jwtService.sign(authPayloadDto2);
      const cfSafe = buildCounterfactualSafe();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken1}`]);
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken2}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken1}`])
        .send({ safes: [cfSafe] })
        .expect(201);

      const getResponse = await request(app.getHttpServer())
        .get('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken2}`])
        .expect(200);

      expect(getResponse.body.safes).toEqual({});
    });

    it('Should return 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/v1/users/counterfactual-safes')
        .expect(403);
    });
  });

  describe('DELETE /v1/users/counterfactual-safes', () => {
    it('Should delete a counterfactual safe', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const cfSafe = buildCounterfactualSafe();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [cfSafe] })
        .expect(201);

      await request(app.getHttpServer())
        .delete('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [{ chainId: cfSafe.chainId, address: cfSafe.address }],
        })
        .expect(204);

      const getResponse = await request(app.getHttpServer())
        .get('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(getResponse.body.safes).toEqual({});
    });

    it('Should return 404 when deleting non-existent safe', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .delete('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(404);
    });

    it("Should not allow deleting a safe the caller isn't associated with", async () => {
      const authPayloadDto1 = siweAuthPayloadDtoBuilder().build();
      const accessToken1 = jwtService.sign(authPayloadDto1);
      const authPayloadDto2 = siweAuthPayloadDtoBuilder().build();
      const accessToken2 = jwtService.sign(authPayloadDto2);
      const cfSafe = buildCounterfactualSafe();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken1}`]);
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken2}`]);

      await request(app.getHttpServer())
        .post('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken1}`])
        .send({ safes: [cfSafe] })
        .expect(201);

      await request(app.getHttpServer())
        .delete('/v1/users/counterfactual-safes')
        .set('Cookie', [`access_token=${accessToken2}`])
        .send({
          safes: [{ chainId: cfSafe.chainId, address: cfSafe.address }],
        })
        .expect(404);
    });

    it('Should return 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .delete('/v1/users/counterfactual-safes')
        .send({
          safes: [
            {
              chainId: '1',
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(403);
    });
  });
});
