import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { authPayloadBuilder } from '@/domain/auth/entities/__tests__/auth-payload.entity.builder';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { getAddress } from 'viem';
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { AccountDoesNotExistError } from '@/domain/account/errors/account-does-not-exist.error';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { TestEmailApiModule } from '@/datasources/email-api/__tests__/test.email-api.module';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { accountBuilder } from '@/domain/account/entities/__tests__/account.builder';
import { INestApplication } from '@nestjs/common';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';

describe('Email controller delete email tests', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let accountDataSource: jest.MockedObjectDeep<IAccountDataSource>;
  let emailApi: jest.MockedObjectDeep<IEmailApi>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
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
      .overrideModule(EmailApiModule)
      .useModule(TestEmailApiModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    accountDataSource = moduleFixture.get(IAccountDataSource);
    emailApi = moduleFixture.get(IEmailApi);
    networkService = moduleFixture.get(NetworkService);
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
    { safeAddress: faker.finance.ethereumAddress().toLowerCase() },
    // checksummed address
    { safeAddress: getAddress(faker.finance.ethereumAddress()) },
  ])('deletes email successfully', async ({ safeAddress }) => {
    const chain = chainBuilder().build();
    const safe = safeBuilder()
      // Allow test of non-checksummed address by casting
      .with('address', safeAddress as `0x${string}`)
      .build();
    const signerAddress = safe.owners[0];
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', signerAddress)
      .build();
    const accessToken = jwtService.sign(authPayload);
    const account = accountBuilder()
      .with('signer', signerAddress)
      .with('chainId', chain.chainId)
      .with('safeAddress', safe.address)
      .build();
    accountDataSource.getAccount.mockResolvedValue(account);
    accountDataSource.deleteAccount.mockResolvedValue(account);
    emailApi.deleteEmailAddress.mockResolvedValue();

    await request(app.getHttpServer())
      .delete(
        `/v1/chains/${chain.chainId}/safes/${safeAddress}/emails/${account.signer}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(204)
      .expect({});

    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(1);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(1);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledWith({
      chainId: chain.chainId,
      // Should always call with the checksummed address
      safeAddress: getAddress(safeAddress),
      signer: signerAddress,
    });
  });

  it("returns 204 if trying to deleting an email that doesn't exist", async () => {
    const chain = chainBuilder().build();
    // Signer is owner of safe
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', signerAddress)
      .build();
    const accessToken = jwtService.sign(authPayload);
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    accountDataSource.getAccount.mockRejectedValueOnce(
      new AccountDoesNotExistError(chain.chainId, safe.address, signerAddress),
    );

    await request(app.getHttpServer())
      .delete(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signerAddress}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(204)
      .expect({});

    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
  });

  it('returns 403 if no token is present', async () => {
    const chain = chainBuilder().build();
    // Signer is owner of safe
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];

    await request(app.getHttpServer())
      .delete(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signerAddress}`,
      )
      .expect(403);

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
  });

  it('returns 403 if token is not a valid JWT', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const accessToken = faker.string.numeric();

    expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
    await request(app.getHttpServer())
      .delete(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signerAddress}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403);

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
  });

  it('returns 403 if token is not yet valid', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', signerAddress)
      .build();
    const notBefore = faker.date.future();
    const accessToken = jwtService.sign(authPayload, {
      notBefore: getSecondsUntil(notBefore),
    });

    expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');
    await request(app.getHttpServer())
      .delete(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signerAddress}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403);

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
  });

  it('returns 403 if token has expired', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', signerAddress)
      .build();
    const accessToken = jwtService.sign(authPayload, {
      expiresIn: 0, // Now
    });
    jest.advanceTimersByTime(1_000);

    expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');
    await request(app.getHttpServer())
      .delete(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signerAddress}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403);

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
  });

  it('returns 403 if signer_address is not a valid Ethereum address', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', faker.string.numeric() as `0x${string}`)
      .build();
    const accessToken = jwtService.sign(authPayload);
    jest.advanceTimersByTime(1_000);

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .delete(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signerAddress}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403);

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
  });

  it('returns 403 if chain_id is not a valid chain ID', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayload = authPayloadBuilder()
      .with('chain_id', faker.string.alpha())
      .with('signer_address', signerAddress)
      .build();
    const accessToken = jwtService.sign(authPayload);

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .delete(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signerAddress}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(403);

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
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
      const signerAddress = safe.owners[0];
      const authPayload = authPayloadBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', signer_address as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayload);

      expect(() => jwtService.verify(accessToken)).not.toThrow();
      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${
            // non-checksummed
            signerAddress.toLowerCase()
          }`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
      expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
      expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
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
      const signerAddress = safe.owners[0];
      const authPayload = authPayloadBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', signer_address as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayload);

      expect(() => jwtService.verify(accessToken)).not.toThrow();
      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${
            // checksummed
            getAddress(signerAddress)
          }`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
      expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
      expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
    },
  );

  it('Returns 401 if chain_id does not match the request', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayload = authPayloadBuilder()
      .with('chain_id', faker.string.numeric({ exclude: [chain.chainId] }))
      .with('signer_address', signerAddress)
      .build();
    const accessToken = jwtService.sign(authPayload);

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .delete(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signerAddress}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(401);

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
  });

  it('returns 500 if email api throws', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayload = authPayloadBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', signerAddress)
      .build();
    const accessToken = jwtService.sign(authPayload);
    const account = accountBuilder()
      .with('signer', signerAddress)
      .with('chainId', chain.chainId)
      .with('safeAddress', safe.address)
      .build();
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    accountDataSource.getAccount.mockResolvedValueOnce(account);
    emailApi.deleteEmailAddress.mockRejectedValue(new Error('Some error'));

    await request(app.getHttpServer())
      .delete(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signerAddress}`,
      )
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(500)
      .expect({ code: 500, message: 'Internal server error' });

    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(1);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
  });
});
