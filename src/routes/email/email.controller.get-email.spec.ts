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
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { accountBuilder } from '@/domain/account/entities/__tests__/account.builder';
import { faker } from '@faker-js/faker';
import { AccountDoesNotExistError } from '@/domain/account/errors/account-does-not-exist.error';

describe('Email controller get email tests', () => {
  let app: INestApplication;
  let accountDataSource: jest.MockedObjectDeep<IAccountDataSource>;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration), EmailControllerModule],
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

    accountDataSource = moduleFixture.get(IAccountDataSource);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Retrieves email if correctly authenticated', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const timestamp = Date.now();
    const message = `email-retrieval-${chain.chainId}-${safe.address}-${signer.address}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    const account = accountBuilder()
      .with('signer', signer.address)
      .with('chainId', chain.chainId)
      .with('safeAddress', safe.address)
      .build();
    accountDataSource.getAccount.mockResolvedValue(account);

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signer.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(200)
      .expect({
        email: account.emailAddress.value,
        verified: account.isVerified,
      });

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(1);
    expect(accountDataSource.getAccount).toHaveBeenCalledWith({
      chainId: chain.chainId.toString(),
      safeAddress: safe.address.toString(),
      signer: signer.address,
    });
  });

  it('Returns 403 if wrong message was signed', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const timestamp = Date.now();
    const message = faker.string.sample(32);
    const signature = await signer.signMessage({ message });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signer.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
  });

  it('Returns 403 if signature expired', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const timestamp = Date.now();
    const message = `email-retrieval-${chain.chainId}-${safe.address}-${signer.address}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    const account = accountBuilder()
      .with('signer', signer.address)
      .with('chainId', chain.chainId)
      .with('safeAddress', safe.address)
      .build();
    accountDataSource.getAccount.mockResolvedValue(account);

    // Advance time by 5 minutes
    jest.advanceTimersByTime(5 * 60 * 1000);

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signer.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });

    expect(accountDataSource.getAccount).toHaveBeenCalledTimes(0);
  });

  it('Returns 404 if signer has no emails', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const timestamp = Date.now();
    const message = `email-retrieval-${chain.chainId}-${safe.address}-${signer.address}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    accountDataSource.getAccount.mockRejectedValue(
      new AccountDoesNotExistError(chain.chainId, safe.address, signer.address),
    );

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/emails/${signer.address}`,
      )
      .set('Safe-Wallet-Signature', signature)
      .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
      .expect(404)
      .expect({
        message: `No email address was found for the provided signer ${signer.address}.`,
        statusCode: 404,
      });
  });
});
