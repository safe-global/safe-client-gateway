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
import { EmailDataSourceModule } from '@/datasources/email/email.datasource.module';
import { TestEmailDatasourceModule } from '@/datasources/email/__tests__/test.email.datasource.module';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { emailBuilder } from '@/domain/email/entities/__tests__/email.builder';

const resendLockWindowMs = 100;
const ttlMs = 1000;

describe('Email controller verify email tests', () => {
  let app;
  let emailDatasource;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const defaultTestConfiguration = configuration();
    const testConfiguration = () => ({
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
      .overrideModule(EmailDataSourceModule)
      .useModule(TestEmailDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    emailDatasource = moduleFixture.get(IEmailDataSource);

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
    const email = emailBuilder()
      .with('isVerified', false)
      .with('verificationCode', faker.string.numeric({ length: 6 }))
      .with('verificationGeneratedOn', new Date())
      .with('verificationSentOn', new Date())
      .build();
    emailDatasource.getEmail.mockResolvedValue(email);

    jest.advanceTimersByTime(ttlMs - 1);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${email.chainId}/safes/${email.safeAddress}/emails/verify`,
      )
      .send({
        account: email.account,
        code: email.verificationCode,
      })
      .expect(204)
      .expect({});

    expect(emailDatasource.verifyEmail).toHaveBeenCalledTimes(1);
  });

  it('returns 204 on already verified emails', async () => {
    const email = emailBuilder().with('isVerified', true).build();
    emailDatasource.getEmail.mockResolvedValueOnce(email);

    jest.advanceTimersByTime(ttlMs - 1);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${email.chainId}/safes/${email.safeAddress}/emails/verify`,
      )
      .send({
        account: email.account,
        code: email.verificationCode,
      })
      .expect(204)
      .expect({});

    expect(emailDatasource.verifyEmail).toHaveBeenCalledTimes(0);
  });

  it('email verification with expired code returns 400', async () => {
    const email = emailBuilder()
      .with('isVerified', false)
      .with('verificationCode', faker.string.numeric({ length: 6 }))
      .with('verificationGeneratedOn', new Date())
      .build();
    emailDatasource.getEmail.mockResolvedValueOnce(email);

    jest.advanceTimersByTime(ttlMs);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${email.chainId}/safes/${email.safeAddress}/emails/verify`,
      )
      .send({
        account: email.account,
        code: email.verificationCode,
      })
      .expect(400)
      .expect({
        message: 'The provided verification code is not valid.',
        statusCode: 400,
      });

    expect(emailDatasource.verifyEmail).toHaveBeenCalledTimes(0);
  });

  it('email verification with wrong code returns 400', async () => {
    const email = emailBuilder()
      .with('isVerified', false)
      .with('verificationCode', faker.string.numeric({ length: 6 }))
      .build();
    emailDatasource.getEmail.mockResolvedValueOnce(email);

    jest.advanceTimersByTime(ttlMs - 1);
    await request(app.getHttpServer())
      .put(
        `/v1/chains/${email.chainId}/safes/${email.safeAddress}/emails/verify`,
      )
      .send({
        account: email.account,
        code: faker.string.numeric({ length: 6 }),
      })
      .expect(400)
      .expect({
        message: 'The provided verification code is not valid.',
        statusCode: 400,
      });

    expect(emailDatasource.verifyEmail).toHaveBeenCalledTimes(0);
  });
});
