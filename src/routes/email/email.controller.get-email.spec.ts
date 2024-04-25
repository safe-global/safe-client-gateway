import { INestApplication } from '@nestjs/common';
import configuration from '@/config/entities/__tests__/configuration';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import * as request from 'supertest';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { authPayloadBuilder } from '@/domain/auth/entities/__tests__/auth-payload.entity.builder';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { accountBuilder } from '@/domain/account/entities/__tests__/account.builder';
import { faker } from '@faker-js/faker';
import { AccountDoesNotExistError } from '@/domain/account/errors/account-does-not-exist.error';
import { getAddress } from 'viem';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';

describe('Email controller get email tests', () => {
  let app: INestApplication;
  let accountDataSource: jest.MockedObjectDeep<IAccountDataSource>;
  let jwtService: IJwtService;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration), EmailControllerModule],
    })
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    accountDataSource = moduleFixture.get(IAccountDataSource);
    jwtService = moduleFixture.get<IJwtService>(IJwtService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    // non-checksummed address
    {
      safeAddress: faker.finance.ethereumAddress().toLowerCase(),
    },
    // checksummed address
    {
      safeAddress: getAddress(faker.finance.ethereumAddress()),
    },
  ])('Retrieves email if correctly authenticated', async ({ safeAddress }) => {
    const chain = chainBuilder().build();
    const safe = safeBuilder()
      // Allow test of non-checksummed address by casting
      .with('address', safeAddress as `0x${string}`)
      .build();
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', safe.owners[0])
      .build();
    const accessToken = jwtService.sign(authPayload);
    const account = accountBuilder()
      .with('signer', safe.owners[0])
      .with('chainId', chain.chainId)
      .with('safeAddress', getAddress(safe.address))
      .build();
    accountDataSource.getAccount.mockResolvedValue(account);

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safeAddress}/emails/${safe.owners[0]}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200)
      .expect({
        email: account.emailAddress.value,
        verified: account.isVerified,
      });

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(1);
    expect(accountDataSource.getAccount).toHaveBeenCalledWith({
      chainId: chain.chainId.toString(),
      // Should always call with the checksummed address
      safeAddress: getAddress(safeAddress),
      signer: safe.owners[0],
    });
  });

  it('Returns 403 if no token is present', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${safe.owners[0]}`,
      )
      .expect(403);

    expect(accountDataSource.getAccount).not.toHaveBeenCalled();
  });

  it('returns 403 if token is not a valid JWT', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const accessToken = faker.string.alphanumeric();

    expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${safe.owners[0]}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403);

    expect(accountDataSource.getAccount).not.toHaveBeenCalled();
  });

  it('returns 403 is token it not yet valid', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', safe.owners[0])
      .build();
    const notBefore = faker.date.future();
    const accessToken = jwtService.sign(authPayload, {
      notBefore: getSecondsUntil(notBefore),
    });

    expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');
    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${safe.owners[0]}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403);

    expect(accountDataSource.getAccount).not.toHaveBeenCalled();
  });

  it('returns 403 if token has expired', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', safe.owners[0])
      .build();
    const accessToken = jwtService.sign(authPayload, {
      expiresIn: 0, // Now
    });
    jest.advanceTimersByTime(1_000);

    expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');
    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${safe.owners[0]}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403);

    expect(accountDataSource.getAccount).not.toHaveBeenCalled();
  });

  it('returns 403 if signer_address is not a valid Ethereum address', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', faker.string.numeric() as `0x${string}`)
      .build();
    const accessToken = jwtService.sign(authPayload);

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${safe.owners[0]}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403);

    expect(accountDataSource.getAccount).not.toHaveBeenCalled();
  });

  it('returns 403 if chain_id is not a valid chain ID', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const authPayload = authPayloadBuilder()
      .with('chain_id', faker.string.alpha())
      .with('signer_address', safe.owners[0])
      .build();
    const accessToken = jwtService.sign(authPayload);

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${safe.owners[0]}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403);

    expect(accountDataSource.getAccount).not.toHaveBeenCalled();
  });

  // Note: this could be removed as we checksum the :signer but for robustness we should keep it
  it.each([
    // non-checksummed address
    {
      signer_address: faker.finance.ethereumAddress().toLowerCase(),
    },
    // checksummed address
    {
      signer_address: getAddress(faker.finance.ethereumAddress()),
    },
  ])(
    'returns 401 if signer_address does not match a non-checksummed signer request',
    async ({ signer_address }) => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const authPayload = authPayloadBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', signer_address as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayload);

      expect(() => jwtService.verify(accessToken)).not.toThrow();
      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${
            // non-checksummed
            safe.owners[0].toLowerCase()
          }`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(accountDataSource.getAccount).not.toHaveBeenCalled();
    },
  );

  it.each([
    // non-checksummed address
    {
      signer_address: faker.finance.ethereumAddress().toLowerCase(),
    },
    // checksummed address
    {
      signer_address: getAddress(faker.finance.ethereumAddress()),
    },
  ])(
    'returns 401 if signer_address does not match a checksummed signer request',
    async ({ signer_address }) => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const authPayload = authPayloadBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', signer_address as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayload);

      expect(() => jwtService.verify(accessToken)).not.toThrow();
      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${
            // checksummed
            getAddress(safe.owners[0])
          }`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(accountDataSource.getAccount).not.toHaveBeenCalled();
    },
  );

  it('Returns 401 if chain_id does not match the request', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const authPayload = authPayloadBuilder()
      .with('chain_id', faker.string.numeric({ exclude: [chain.chainId] }))
      .with('signer_address', safe.owners[0])
      .build();
    const accessToken = jwtService.sign(authPayload);

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${safe.owners[0]}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(401);

    expect(accountDataSource.getAccount).not.toHaveBeenCalled();
  });

  it('Returns 404 if signer has no emails', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', safe.owners[0])
      .build();
    const accessToken = jwtService.sign(authPayload);
    accountDataSource.getAccount.mockRejectedValue(
      new AccountDoesNotExistError(chain.chainId, safe.address, safe.owners[0]),
    );

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${safe.owners[0]}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(404)
      .expect({
        message: `No email address was found for the provided signer ${safe.owners[0]}.`,
        statusCode: 404,
      });
  });
});
