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
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { INestApplication } from '@nestjs/common';
import { accountBuilder } from '@/domain/account/entities/__tests__/account.builder';
import { verificationCodeBuilder } from '@/domain/account/entities/__tests__/verification-code.builder';

const resendLockWindowMs = 100;
const ttlMs = 1000;

describe('Email controller verify email tests', () => {
  let app: INestApplication;
  let accountDataSource: jest.MockedObjectDeep<IAccountDataSource>;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    const defaultTestConfiguration = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...defaultTestConfiguration,
      email: {
        ...defaultTestConfiguration['email'],
        verificationCode: {
          resendLockWindowMs: resendLockWindowMs,
          ttlMs: ttlMs,
        },
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration), EmailControllerModule],
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

  it('verifies email successfully', async () => {
    const account = accountBuilder().with('isVerified', false).build();
    const verificationCode = verificationCodeBuilder().build();
    accountDataSource.getAccount.mockResolvedValue(account);
    accountDataSource.getAccountVerificationCode.mockResolvedValue(
      verificationCode,
    );

    jest.advanceTimersByTime(ttlMs - 1);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${account.chainId}/safes/${account.safeAddress}/emails/${account.signer}/verify`,
      )
      .send({
        code: verificationCode.code,
      })
      .expect(204)
      .expect({});

    expect(accountDataSource.verifyEmail).toHaveBeenCalledTimes(1);
  });

  it('returns 400 on already verified emails', async () => {
    const account = accountBuilder().with('isVerified', true).build();
    accountDataSource.getAccount.mockResolvedValueOnce(account);

    jest.advanceTimersByTime(ttlMs - 1);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${account.chainId}/safes/${account.safeAddress}/emails/${account.signer}/verify`,
      )
      .send({
        code: faker.string.numeric({ length: 6 }),
      })
      .expect(400)
      .expect('');

    expect(accountDataSource.verifyEmail).toHaveBeenCalledTimes(0);
    expect(accountDataSource.getAccountVerificationCode).toHaveBeenCalledTimes(
      0,
    );
  });

  it('email verification with expired code returns 400', async () => {
    const account = accountBuilder().with('isVerified', false).build();
    accountDataSource.getAccount.mockResolvedValueOnce(account);
    const verificationCode = verificationCodeBuilder().build();
    accountDataSource.getAccountVerificationCode.mockResolvedValue(
      verificationCode,
    );

    jest.advanceTimersByTime(ttlMs);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${account.chainId}/safes/${account.safeAddress}/emails/${account.signer}/verify`,
      )
      .send({
        account: account.signer,
        code: verificationCode.code,
      })
      .expect(400)
      .expect('');

    expect(accountDataSource.verifyEmail).toHaveBeenCalledTimes(0);
  });

  it('email verification with wrong code returns 400', async () => {
    const account = accountBuilder().with('isVerified', false).build();
    accountDataSource.getAccount.mockResolvedValueOnce(account);
    const verificationCode = verificationCodeBuilder().build();
    accountDataSource.getAccountVerificationCode.mockResolvedValue(
      verificationCode,
    );

    jest.advanceTimersByTime(ttlMs - 1);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${account.chainId}/safes/${account.safeAddress}/emails/${account.signer}/verify`,
      )
      .send({
        account: account.signer,
        code: faker.string.numeric({ length: 6 }),
      })
      .expect(400)
      .expect('');

    expect(accountDataSource.verifyEmail).toHaveBeenCalledTimes(0);
  });
});
