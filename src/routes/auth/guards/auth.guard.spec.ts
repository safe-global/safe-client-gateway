import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload.entity.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { faker } from '@faker-js/faker';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';

@Controller()
class TestController {
  @Get('valid')
  @UseGuards(AuthGuard)
  async validRoute(): Promise<{ secret: string }> {
    return { secret: 'This is a secret message' };
  }
}

describe('AuthGuard', () => {
  let app: INestApplication;
  let jwtService: IJwtService;

  beforeEach(async () => {
    jest.useFakeTimers();

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
        AuthRepositoryModule,
      ],
      controllers: [TestController],
    })
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .compile();

    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await app.close();
  });

  it('should not allow access if there is no token', async () => {
    await request(app.getHttpServer()).get('/valid').expect(403).expect({
      message: 'Forbidden resource',
      error: 'Forbidden',
      statusCode: 403,
    });
  });

  it('should not allow access if verification of the token fails', async () => {
    const accessToken = faker.string.alphanumeric();

    expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');

    await request(app.getHttpServer())
      .get('/valid')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if a token is not yet valid', async () => {
    const authPayloadDto = authPayloadDtoBuilder().build();
    const notBefore = faker.date.future();
    const accessToken = jwtService.sign(authPayloadDto, {
      notBefore: getSecondsUntil(notBefore),
    });

    expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');

    await request(app.getHttpServer())
      .get('/valid')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if a token has expired', async () => {
    const authPayloadDto = authPayloadDtoBuilder().build();
    const expiresIn = 0; // Now
    const accessToken = jwtService.sign(authPayloadDto, {
      expiresIn,
    });
    jest.advanceTimersByTime(1_000);

    expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');

    await request(app.getHttpServer())
      .get('/valid')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if a verified token is not that of a AuthPayload', async () => {
    const authPayloadDto = {
      unknown: 'payload',
    };
    const accessToken = jwtService.sign(authPayloadDto);

    expect(() => jwtService.verify(accessToken)).not.toThrow();

    await request(app.getHttpServer())
      .get('/valid')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  describe('should allow access if the AuthPayload is valid', () => {
    it('when notBefore nor expiresIn is specified', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get('/valid')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });

    it('when notBefore is and expirationTime is not specified', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const notBefore = faker.date.past();
      const accessToken = jwtService.sign(authPayloadDto, {
        notBefore: getSecondsUntil(notBefore),
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get('/valid')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });

    it('when expiresIn is and notBefore is not specified', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const expiresIn = faker.date.future();
      const accessToken = jwtService.sign(authPayloadDto, {
        expiresIn: getSecondsUntil(expiresIn),
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get('/valid')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });

    it('when notBefore and expirationTime are specified', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const notBefore = faker.date.past();
      const expiresIn = faker.date.future();
      const accessToken = jwtService.sign(authPayloadDto, {
        notBefore: getSecondsUntil(notBefore),
        expiresIn: getSecondsUntil(expiresIn),
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get('/valid')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });
  });
});
