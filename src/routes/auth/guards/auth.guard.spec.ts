import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { AuthDomainModule } from '@/domain/auth/auth.domain.module';
import { siweMessageBuilder } from '@/domain/auth/entities/__tests__/siwe-message.builder';
import { IJwtService } from '@/domain/interfaces/jwt-api.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { faker } from '@faker-js/faker';
import { Get, INestApplication } from '@nestjs/common';
import { Controller, UseGuards } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';

@Controller()
class TestController {
  @Get('valid')
  @UseGuards(AuthGuard)
  async validRoute(): Promise<void> {}
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
        JwtModule,
        AuthDomainModule,
      ],
      controllers: [TestController],
    }).compile();
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
      .set('authorization', `Bearer ${accessToken}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if a token is not yet valid', async () => {
    const message = siweMessageBuilder().build();
    const accessToken = jwtService.sign(message, {
      notBefore: faker.date.past().getTime(),
    });

    expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');

    await request(app.getHttpServer())
      .get('/valid')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if a token has expired', async () => {
    const message = siweMessageBuilder().build();
    const accessToken = jwtService.sign(message, {
      expiresIn: 0,
    });
    jest.advanceTimersByTime(1);

    expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');

    await request(app.getHttpServer())
      .get('/valid')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if a verified token is not that of a SiweMessage', async () => {
    const accessToken = jwtService.sign({
      message: 'not a SiweMessage',
    });

    await request(app.getHttpServer())
      .get('/valid')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if the SiweMessage has expired', async () => {
    const message = siweMessageBuilder()
      .with('expirationTime', new Date(faker.date.past()).toISOString())
      .build();
    const accessToken = jwtService.sign(message);

    expect(() => jwtService.verify(accessToken)).not.toThrow();

    await request(app.getHttpServer())
      .get('/valid')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if the SiweMessage is not yet valid', async () => {
    const message = siweMessageBuilder()
      .with('notBefore', new Date(faker.date.future()).toISOString())
      .build();
    const accessToken = jwtService.sign(message);

    expect(() => jwtService.verify(accessToken)).not.toThrow();

    await request(app.getHttpServer())
      .get('/valid')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should allow access if the SiweMessage is valid', async () => {
    const message = siweMessageBuilder()
      .with('expirationTime', new Date(faker.date.future()).toISOString())
      .build();
    const accessToken = jwtService.sign(message);

    await request(app.getHttpServer())
      .get('/valid')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect({});
  });
});
