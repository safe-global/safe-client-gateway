import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { OptionalAuthGuard } from '@/routes/auth/guards/optional-auth.guard';
import { faker } from '@faker-js/faker';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { Server } from 'net';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';

@Controller()
class TestController {
  @Get('valid')
  @UseGuards(OptionalAuthGuard)
  validRoute(): { secret: string } {
    return { secret: 'This is a secret message' };
  }
}

describe('OptionalAuthGuard', () => {
  let app: INestApplication<Server>;
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
      providers: [AuthGuard],
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

  it('should allow access if there is no token', async () => {
    await request(app.getHttpServer())
      .get('/valid')
      .expect(200)
      .expect({ secret: 'This is a secret message' });
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
    const accessToken = jwtService.sign({
      ...authPayloadDto,
      nbf: faker.date.future(),
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
    const accessToken = jwtService.sign({
      ...authPayloadDto,
      exp: new Date(), // Now
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
    const authPayload = {
      unknown: 'payload',
    };
    const accessToken = jwtService.sign(authPayload);

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
    it('when nbf nor exp is specified', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get('/valid')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });

    it('when nbf is and exp is not specified', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        nbf: faker.date.past(),
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get('/valid')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });

    it('when exp is and nbf is not specified', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        exp: faker.date.future(),
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get('/valid')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });

    it('when nbf and exp are specified', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        nbf: faker.date.past(),
        exp: faker.date.future(),
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
