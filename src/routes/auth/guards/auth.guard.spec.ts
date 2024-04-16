import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { jwtAccessTokenPayloadBuilder } from '@/routes/auth/entities/schemas/__tests__/jwt-access-token.payload.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { faker } from '@faker-js/faker';
import { Get, INestApplication, Module } from '@nestjs/common';
import { Controller, UseGuards } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtRepositoryModule } from '@/domain/jwt/jwt.repository.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { AppModule } from '@/app.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';

@Controller()
class TestController {
  @Get('valid/:safeAddress')
  @UseGuards(AuthGuard)
  async validRoute(): Promise<{ secret: string }> {
    return { secret: 'This is a secret message' };
  }

  @Get('invalid')
  @UseGuards(AuthGuard)
  async invalidRoute(): Promise<{ secret: string }> {
    return { secret: 'This is a different secret message' };
  }
}

@Module({
  imports: [JwtRepositoryModule, SafeRepositoryModule],
  controllers: [TestController],
})
class TestModule {}

describe('AuthGuard', () => {
  let app: INestApplication;
  let jwtService: IJwtService;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let safeConfigUrl: string | undefined;

  beforeEach(async () => {
    jest.useFakeTimers();

    const testConfiguration: typeof configuration = () => ({
      ...configuration(),
      features: {
        ...configuration().features,
        auth: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration), TestModule],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    networkService = moduleFixture.get(NetworkService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await app.close();
  });

  it('should not allow access if there is no Safe address', async () => {
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder().build();
    const accessToken = jwtService.sign(jwtAccessTokenPayload);

    expect(() => jwtService.verify(accessToken)).not.toThrow();

    await request(app.getHttpServer())
      .get('/invalid')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if there is no token', async () => {
    const safeAddress = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .get(`/valid/${safeAddress}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if verification of the token fails', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const accessToken = faker.string.alphanumeric();

    expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');

    await request(app.getHttpServer())
      .get(`/valid/${safeAddress}`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if a token is not yet valid', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder().build();
    const notBefore = faker.date.future();
    const accessToken = jwtService.sign(jwtAccessTokenPayload, {
      notBefore: getSecondsUntil(notBefore),
    });

    expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');

    await request(app.getHttpServer())
      .get(`/valid/${safeAddress}`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if a token has expired', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder().build();
    const expiresIn = 0; // Now
    const accessToken = jwtService.sign(jwtAccessTokenPayload, {
      expiresIn,
    });
    jest.advanceTimersByTime(1);

    expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');

    await request(app.getHttpServer())
      .get(`/valid/${safeAddress}`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if a verified token is not that of a JwtAccessTokenPayload', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const jwtAccessTokenPayload = {
      unknown: 'payload',
    };
    const accessToken = jwtService.sign(jwtAccessTokenPayload);

    expect(() => jwtService.verify(accessToken)).not.toThrow();

    await request(app.getHttpServer())
      .get(`/valid/${safeAddress}`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    // No owner check as the token didn't pass validation
    expect(networkService.get).not.toHaveBeenCalled();
  });

  it('should not allow access if a token is from a different chain', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder()
      .with('chain_id', faker.string.numeric({ exclude: chain.chainId }))
      .with('signer_address', safe.owners[0])
      .build();
    const accessToken = jwtService.sign(jwtAccessTokenPayload);

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    expect(() => jwtService.verify(accessToken)).not.toThrow();

    await request(app.getHttpServer())
      .get(`/valid/${safe.address}`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('should not allow access if a the signer is not an owner', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder()
      .with('chain_id', chain.chainId)
      .build();
    const accessToken = jwtService.sign(jwtAccessTokenPayload);

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    expect(safe.owners.includes(jwtAccessTokenPayload.signer_address)).toBe(
      false,
    );

    await request(app.getHttpServer())
      .get(`/valid/${safe.address}`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  describe('should allow access if the JwtAccessTokenSchema is valid and from the current chain', () => {
    it('when notBefore nor expiresIn is specified', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', safe.owners[0])
        .build();
      const accessToken = jwtService.sign(jwtAccessTokenPayload);

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({ data: safe, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get(`/valid/${safe.address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });

    it('when notBefore is and expirationTime is not specified', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', safe.owners[0])
        .build();
      const notBefore = faker.date.past();
      const accessToken = jwtService.sign(jwtAccessTokenPayload, {
        notBefore: getSecondsUntil(notBefore),
      });

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({ data: safe, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get(`/valid/${safe.address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });

    it('when expiresIn is and notBefore is not specified', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', safe.owners[0])
        .build();
      const expiresIn = faker.date.future();
      const accessToken = jwtService.sign(jwtAccessTokenPayload, {
        expiresIn: getSecondsUntil(expiresIn),
      });

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({ data: safe, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get(`/valid/${safe.address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });

    it('when notBefore and expirationTime are specified', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', safe.owners[0])
        .build();
      const notBefore = faker.date.past();
      const expiresIn = faker.date.future();
      const accessToken = jwtService.sign(jwtAccessTokenPayload, {
        notBefore: getSecondsUntil(notBefore),
        expiresIn: getSecondsUntil(expiresIn),
      });

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({ data: safe, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();

      await request(app.getHttpServer())
        .get(`/valid/${safe.address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ secret: 'This is a secret message' });
    });
  });
});
