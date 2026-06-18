// SPDX-License-Identifier: FSL-1.1-MIT
import { type Server } from 'node:http';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { NestedSafesGraphController } from '@/modules/spaces/routes/nested-safes-graph.controller';

describe('NestedSafesGraphController', () => {
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
    });

    jwtService = moduleFixture.get<IJwtService>(IJwtService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('applies AuthGuard to every endpoint', () => {
    const endpoints = Object.values(
      NestedSafesGraphController.prototype,
    ) as Array<(...args: Array<unknown>) => unknown>;

    for (const fn of endpoints) {
      checkGuardIsApplied(AuthGuard, fn);
    }
  });

  it('returns 403 for a non-member', async () => {
    const adminToken = jwtService.sign(siweAuthPayloadDtoBuilder().build());
    const nonMemberToken = jwtService.sign(siweAuthPayloadDtoBuilder().build());

    await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [`access_token=${adminToken}`]);
    await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [`access_token=${nonMemberToken}`]);

    const createSpace = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${adminToken}`])
      .send({ name: faker.company.name() });
    const spaceId = createSpace.body.id;

    await request(app.getHttpServer())
      .get(`/v1/spaces/${spaceId}/nested-safes-graph?chainId=1`)
      .set('Cookie', [`access_token=${nonMemberToken}`])
      .expect(403);
  });

  it('returns an empty graph for a member space with no safes on the chain', async () => {
    const token = jwtService.sign(siweAuthPayloadDtoBuilder().build());
    await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [`access_token=${token}`]);

    const createSpace = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${token}`])
      .send({ name: faker.company.name() });
    const spaceId = createSpace.body.id;

    await request(app.getHttpServer())
      .get(`/v1/spaces/${spaceId}/nested-safes-graph?chainId=1`)
      .set('Cookie', [`access_token=${token}`])
      .expect(200)
      .expect((res) => {
        expect(res.body.chainId).toBe('1');
        expect(res.body.nodes).toEqual([]);
        expect(res.body.edges).toEqual([]);
        expect(res.body.truncated).toBe(false);
      });
  });
});
