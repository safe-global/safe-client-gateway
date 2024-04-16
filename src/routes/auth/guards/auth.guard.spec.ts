import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { jwtAccessTokenPayloadBuilder } from '@/routes/auth/entities/schemas/__tests__/jwt-access-token.payload.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { faker } from '@faker-js/faker';
import { Get, INestApplication } from '@nestjs/common';
import { Controller, UseGuards } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtRepositoryModule } from '@/domain/jwt/jwt.repository.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';

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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TestLoggingModule,
        ConfigurationModule.register(configuration),
        CacheModule,
        JwtRepositoryModule,
      ],
      controllers: [TestController],
    })
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
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder().build();
    const notBefore = faker.date.future();
    const accessToken = jwtService.sign(jwtAccessTokenPayload, {
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
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder().build();
    const expiresIn = 0; // Now
    const accessToken = jwtService.sign(jwtAccessTokenPayload, {
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

  it('should not allow access if a verified token is not that of a JwtAccessTokenPayload', async () => {
    const jwtAccessTokenPayload = {
      unknown: 'payload',
    };
    const accessToken = jwtService.sign(jwtAccessTokenPayload);

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

  describe('should allow access if the JwtAccessTokenSchema is valid', () => {
    it('when notBefore nor expiresIn is specified', async () => {
      const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder().build();
      const accessToken = jwtService.sign(jwtAccessTokenPayload);

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get('/valid')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });

    it('when notBefore is and expirationTime is not specified', async () => {
      const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder().build();
      const notBefore = faker.date.past();
      const accessToken = jwtService.sign(jwtAccessTokenPayload, {
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
      const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder().build();
      const expiresIn = faker.date.future();
      const accessToken = jwtService.sign(jwtAccessTokenPayload, {
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
      const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder().build();
      const notBefore = faker.date.past();
      const expiresIn = faker.date.future();
      const accessToken = jwtService.sign(jwtAccessTokenPayload, {
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
