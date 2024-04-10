import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import configuration from '@/config/entities/__tests__/configuration';
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { TestEmailApiModule } from '@/datasources/email-api/__tests__/test.email-api.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { Subscription } from '@/domain/account/entities/subscription.entity';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { INestApplication } from '@nestjs/common';

describe('Subscription Controller tests', () => {
  let app: INestApplication;
  let accountDataSource: jest.MockedObjectDeep<IAccountDataSource>;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    const defaultTestConfiguration = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...defaultTestConfiguration,
      features: {
        ...defaultTestConfiguration.features,
        email: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration), EmailControllerModule],
    })
      .overrideModule(EmailApiModule)
      .useModule(TestEmailApiModule)
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

  afterAll(async () => {
    await app.close();
  });

  it('unsubscribes from a category successfully', async () => {
    const subscriptionKey = faker.word.sample();
    const subscriptionName = faker.word.sample(2);
    const token = faker.string.uuid();
    const subscriptions = [
      {
        key: subscriptionKey,
        name: subscriptionName,
      },
    ] as Subscription[];
    accountDataSource.unsubscribe.mockResolvedValueOnce(subscriptions);

    await request(app.getHttpServer())
      .delete(`/v1/subscriptions/?category=${subscriptionKey}&token=${token}`)
      .expect(200)
      .expect({});

    expect(accountDataSource.unsubscribe).toHaveBeenCalledWith({
      notificationTypeKey: subscriptionKey,
      token: token,
    });
    expect(accountDataSource.unsubscribeAll).toHaveBeenCalledTimes(0);
  });

  it('validates uuid format when deleting category', async () => {
    const subscriptionKey = faker.word.sample();
    const token = faker.string.hexadecimal();

    await request(app.getHttpServer())
      .delete(`/v1/subscriptions/?category=${subscriptionKey}&token=${token}`)
      .expect(400)
      .expect({
        message: 'Validation failed (uuid is expected)',
        error: 'Bad Request',
        statusCode: 400,
      });

    expect(accountDataSource.unsubscribe).toHaveBeenCalledTimes(0);
    expect(accountDataSource.unsubscribeAll).toHaveBeenCalledTimes(0);
  });

  it('deleting category is not successful', async () => {
    const subscriptionKey = faker.word.sample();
    const token = faker.string.uuid();
    accountDataSource.unsubscribe.mockRejectedValueOnce(
      new Error('some error'),
    );

    await request(app.getHttpServer())
      .delete(`/v1/subscriptions/?category=${subscriptionKey}&token=${token}`)
      .expect(500)
      .expect({ code: 500, message: 'Internal server error' });
  });

  it('deletes all categories successfully', async () => {
    const subscriptionKey = faker.word.sample();
    const subscriptionName = faker.word.sample(2);
    const token = faker.string.uuid();
    const subscriptions = [
      {
        key: subscriptionKey,
        name: subscriptionName,
      },
    ] as Subscription[];
    accountDataSource.unsubscribeAll.mockResolvedValueOnce(subscriptions);

    await request(app.getHttpServer())
      .delete(`/v1/subscriptions/all?token=${token}`)
      .expect(200)
      .expect({});

    expect(accountDataSource.unsubscribeAll).toHaveBeenCalledWith({
      token: token,
    });
    expect(accountDataSource.unsubscribe).toHaveBeenCalledTimes(0);
  });

  it('validates uuid format when deleting all categories', async () => {
    const subscriptionKey = faker.word.sample();
    const subscriptionName = faker.word.sample(2);
    const token = faker.string.hexadecimal();
    const subscriptions = [
      {
        key: subscriptionKey,
        name: subscriptionName,
      },
    ] as Subscription[];
    accountDataSource.unsubscribe.mockResolvedValueOnce(subscriptions);

    await request(app.getHttpServer())
      .delete(`/v1/subscriptions/all?token=${token}`)
      .expect(400)
      .expect({
        message: 'Validation failed (uuid is expected)',
        error: 'Bad Request',
        statusCode: 400,
      });

    expect(accountDataSource.unsubscribe).toHaveBeenCalledTimes(0);
    expect(accountDataSource.unsubscribeAll).toHaveBeenCalledTimes(0);
  });

  it('deleting all categories is not successful', async () => {
    const token = faker.string.uuid();
    accountDataSource.unsubscribeAll.mockRejectedValueOnce(
      new Error('some error'),
    );

    await request(app.getHttpServer())
      .delete(`/v1/subscriptions/all?token=${token}`)
      .expect(500)
      .expect({ code: 500, message: 'Internal server error' });
  });
});
