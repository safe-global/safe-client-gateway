import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { authPayloadBuilder } from '@/domain/auth/entities/__tests__/auth-payload.entity.builder';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import {
  INestApplication,
  Controller,
  Get,
  Module,
  UseGuards,
} from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';

describe('Auth decorator', () => {
  let app: INestApplication;
  let jwtService: IJwtService;
  let authPayloadFromDecoractor: AuthPayload;

  @Controller()
  class TestController {
    @Get('/open')
    nonAuthorizedRoute(@Auth() authPayload: AuthPayload): void {
      authPayloadFromDecoractor = authPayload;
      return;
    }

    @UseGuards(AuthGuard)
    @Get('/auth')
    authorized(@Auth() authPayload: AuthPayload): void {
      authPayloadFromDecoractor = authPayload;
      return;
    }
  }

  @Module({ imports: [AuthRepositoryModule], controllers: [TestController] })
  class TestModule {}

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
        TestModule,
        TestLoggingModule,
        ConfigurationModule.register(testConfiguration),
        CacheModule,
        TestNetworkModule,
      ],
    })
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .compile();

    app = await new TestAppProvider().provide(moduleFixture);
    jwtService = app.get<IJwtService>(IJwtService);
    await app.init();
  });

  it('no token', async () => {
    await request(app.getHttpServer()).get('/open').expect(200);

    expect(authPayloadFromDecoractor).toBe(undefined);
  });

  it('with token', async () => {
    const authPayload = authPayloadBuilder().build();
    const accessToken = jwtService.sign(authPayload);

    await request(app.getHttpServer())
      .get('/auth')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200);

    expect(authPayloadFromDecoractor).toStrictEqual(authPayload);
  });
});
