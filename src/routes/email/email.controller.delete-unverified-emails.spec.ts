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
import { faker } from '@faker-js/faker';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { Email, EmailAddress } from '@/domain/email/entities/email.entity';

const oneWeekInMs = 7 * 24 * 60 * 60 * 1_000;

describe('Email controller delete unverified emails tests', () => {
  let app;
  let emailDatasource;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // The CRON job runs every Sunday at 00:00:00:000
    // Sunday 24.12.23 00:00:01
    const now = new Date('2023-12-24T00:00:00.001Z');
    jest.setSystemTime(now);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration), EmailControllerModule],
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

  it('deletes unverified emails older than a week after a week successfully', async () => {
    const chain = chainBuilder().build();
    const account = faker.finance.ethereumAddress();
    const safe = safeBuilder().with('owners', [account]).build();
    const emailAddress = faker.internet.email();
    const verificationCode = faker.string.numeric({ length: 6 });
    const verificationGeneratedOn = new Date();
    const verificationSentOn = new Date();

    emailDatasource.getUnverifiedEmailsUntil.mockResolvedValue(<Email[]>[
      {
        chainId: chain.chainId,
        emailAddress: new EmailAddress(emailAddress),
        isVerified: false,
        safeAddress: safe.address,
        account,
        verificationCode,
        verificationGeneratedOn,
        verificationSentOn,
      },
    ]);
    emailDatasource.deleteEmail.mockResolvedValue();

    jest.advanceTimersByTime(oneWeekInMs);

    await expect(
      emailDatasource.getUnverifiedEmailsUntil,
    ).toHaveBeenCalledTimes(1);
    expect(emailDatasource.deleteEmail).toHaveBeenCalledTimes(1);
    expect(emailDatasource.deleteEmail).toHaveBeenCalledWith({
      chainId: chain.chainId,
      safeAddress: safe.address,
      account,
    });
  });

  it('does not run until a week has passed', () => {
    // TODO: Remove after setting Jest timezone to UTC
    expect(new Date().getTimezoneOffset()).toBe(0);

    emailDatasource.getUnverifiedEmailsUntil.mockResolvedValue([]);

    // Saturday 30.12.23 23:59:59:999
    jest.advanceTimersByTime(oneWeekInMs - 2);

    expect(emailDatasource.getUnverifiedEmailsUntil).toHaveBeenCalledTimes(0);

    // Sunday 31.12.23 00:00:00:000
    jest.advanceTimersByTime(1);
    expect(emailDatasource.getUnverifiedEmailsUntil).toHaveBeenCalledTimes(1);
  });

  it('does not delete unverified emails younger than a week after a week', () => {
    const today = new Date();
    const chain = chainBuilder().build();
    const account = faker.finance.ethereumAddress();
    const safe = safeBuilder().with('owners', [account]).build();
    const emailAddress = faker.internet.email();
    const verificationCode = faker.string.numeric({ length: 6 });
    const verificationGeneratedOn = new Date(today.getTime() - oneWeekInMs - 1); // Just under a week

    emailDatasource.getUnverifiedEmailsUntil.mockResolvedValue(<Email[]>[
      {
        chainId: chain.chainId,
        emailAddress: new EmailAddress(emailAddress),
        isVerified: true,
        safeAddress: safe.address,
        account,
        verificationCode,
        verificationGeneratedOn: verificationGeneratedOn,
        verificationSentOn: verificationGeneratedOn,
      },
    ]);

    jest.advanceTimersByTime(oneWeekInMs);

    expect(emailDatasource.getUnverifiedEmailsUntil).toHaveBeenCalledTimes(1);
    expect(emailDatasource.deleteEmail).toHaveBeenCalledTimes(0);
  });
});
