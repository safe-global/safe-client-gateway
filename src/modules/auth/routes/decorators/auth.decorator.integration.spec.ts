// SPDX-License-Identifier: FSL-1.1-MIT
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import {
  AuthPayload,
  AuthPayloadDto,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { UsersModule } from '@/modules/users/users.module';
import { TestUsersModule } from '@/modules/users/__tests__/test.users.module';
import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import { Server } from 'net';
import request from 'supertest';

describe('Auth decorator', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let authPayloadFromDecoractor: AuthPayloadDto;

  @Controller()
  class TestController {
    @Get('/open')
    nonAuthorizedRoute(@Auth() authPayload: AuthPayloadDto): void {
      authPayloadFromDecoractor = authPayload;
      return;
    }

    @UseGuards(AuthGuard)
    @Get('/auth')
    authorized(@Auth() authPayload: AuthPayloadDto): void {
      authPayloadFromDecoractor = authPayload;
      return;
    }
  }

  beforeEach(async () => {
    jest.resetAllMocks();

    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      features: {
        ...baseConfiguration.features,
        auth: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TestLoggingModule,
        ConfigurationModule.register(testConfiguration),
        CacheModule,
        AuthModule,
      ],
      controllers: [TestController],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(UsersModule)
      .useModule(TestUsersModule)
      .compile();

    app = await new TestAppProvider().provide(moduleFixture);
    jwtService = app.get<IJwtService>(IJwtService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('no token', async () => {
    await request(app.getHttpServer()).get('/open').expect(200);

    expect(authPayloadFromDecoractor).toStrictEqual(new AuthPayload());
  });

  it('with token', async () => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const accessToken = jwtService.sign(authPayloadDto);

    await request(app.getHttpServer())
      .get('/auth')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200);

    expect(authPayloadFromDecoractor).toStrictEqual(
      new AuthPayload(authPayloadDto),
    );
  });
});
