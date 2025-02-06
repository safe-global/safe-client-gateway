import { Test } from '@nestjs/testing';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountsDataSourceModule } from '@/datasources/accounts/__tests__/test.accounts.datasource.module';
import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { TestAddressBooksDataSourceModule } from '@/datasources/accounts/address-books/__tests__/test.address-books.datasource.module';
import { AddressBooksDatasourceModule } from '@/datasources/accounts/address-books/address-books.datasource.module';
import { TestCounterfactualSafesDataSourceModule } from '@/datasources/accounts/counterfactual-safes/__tests__/test.counterfactual-safes.datasource.module';
import { CounterfactualSafesDatasourceModule } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/domain/notifications/v2/test.notification.repository.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { OrganizationsController } from '@/routes/organizations/organizations.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';

describe('OrganizationsController', () => {
  let app: INestApplication<Server>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        users: true,
      },
    });

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(AccountsDatasourceModule)
      .useModule(TestAccountsDataSourceModule)
      .overrideModule(AddressBooksDatasourceModule)
      .useModule(TestAddressBooksDataSourceModule)
      .overrideModule(CounterfactualSafesDatasourceModule)
      .useModule(TestCounterfactualSafesDataSourceModule)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(NotificationsRepositoryV2Module)
      .useModule(TestNotificationsRepositoryV2Module)
      .compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should require authentication for every endpoint', () => {
    const endpoints = Object.values(
      OrganizationsController.prototype,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    ) as Array<Function>;

    endpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
  });

  describe('POST /v1/organizations/:orgId/members', () => {
    it.todo('should invite a user');

    it.todo('should return 401 if not authenticated');

    it.todo('should return 401 is AuthPayload is empty');

    it.todo('should return 404 if no organization is found');

    it.todo('should return 401 if signer is not an admin');

    it.todo(
      'should return 401 if walletAddress is not a member of the organization',
    );
  });

  describe('POST /v1/organizations/:orgId/members/:userOrgId/accept', () => {
    it.todo('should accept an invite for a user with a specific userOrgId');

    it.todo('should return 401 if not authenticated');

    it.todo('should return 401 is AuthPayload is empty');

    it.todo('should return 404 if no organization is found');

    it.todo('should return 409 if invite is not pending');

    it.todo('should return 401 if signer is not an member');
  });

  describe('POST /v1/organizations/:orgId/members/:userOrgId/decline', () => {
    it.todo('should decline an invite for a user with a specific userOrgId');

    it.todo('should return 401 if not authenticated');

    it.todo('should return 401 is AuthPayload is empty');

    it.todo('should return 404 if no organization is found');

    it.todo('should return 409 if invite is not pending');

    it.todo('should return 401 if signer is not an member');
  });

  describe('GET /v1/organizations/:orgId/members', () => {
    it.todo('should return a list of members of an organization');

    it.todo('should return 401 if not authenticated');

    it.todo('should return 401 is AuthPayload is empty');

    it.todo('should return 404 if no organization is found');

    it.todo('should return 401 if signer is not an member');
  });

  describe('POST /v1/organizations/:orgId/members/:userOrgId/role', () => {
    it.todo('should update a role');

    it.todo('should return 401 if not authenticated');

    it.todo('should return 401 is AuthPayload is empty');

    it.todo('should return 404 if no organization is found');

    it.todo('should return 401 if signer is not an member');

    it.todo('should return 401 if signer is not an ADMIN');
  });

  describe('DELETE /v1/organizations/:orgId/members/:userOrgId', () => {
    it.todo('should remove a user');

    it.todo('should return 401 if not authenticated');

    it.todo('should return 401 is AuthPayload is empty');

    it.todo('should return 404 if no organization is found');

    it.todo('should return 401 if signer is not an member');

    it.todo('should return 401 if signer is not an ADMIN');
  });
});
