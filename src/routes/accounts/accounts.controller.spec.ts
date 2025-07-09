import { TestAppProvider } from '@/__tests__/test-app.provider';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
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
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { accountDataSettingBuilder } from '@/domain/accounts/entities/__tests__/account-data-setting.builder';
import { accountDataTypeBuilder } from '@/domain/accounts/entities/__tests__/account-data-type.builder';
import { accountBuilder } from '@/domain/accounts/entities/__tests__/account.builder';
import { createAccountDtoBuilder } from '@/domain/accounts/entities/__tests__/create-account.dto.builder';
import { upsertAccountDataSettingsDtoBuilder } from '@/domain/accounts/entities/__tests__/upsert-account-data-settings.dto.entity.builder';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { AccountsController } from '@/routes/accounts/accounts.controller';
import type { Account } from '@/routes/accounts/entities/account.entity';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { Server } from 'net';
import request from 'supertest';
import { getAddress } from 'viem';

describe('AccountsController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let accountDataSource: jest.MockedObjectDeep<IAccountsDatasource>;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        accounts: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
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
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .compile();
    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    accountDataSource = moduleFixture.get(IAccountsDatasource);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('AuthGuard', () => {
    it('checks that the AuthGuard is applied to the proper controller endpoints', () => {
      const protectedEndpoints = [
        AccountsController.prototype.createAccount,
        AccountsController.prototype.getAccountDataSettings,
        AccountsController.prototype.upsertAccountDataSettings,
        AccountsController.prototype.getAccount,
        AccountsController.prototype.deleteAccount,
      ];
      protectedEndpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
    });
  });

  describe('Create accounts', () => {
    it('should create an account', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', createAccountDto.address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      accountDataSource.createAccount.mockResolvedValue(account);

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createAccountDto)
        .expect(201);

      expect(accountDataSource.createAccount).toHaveBeenCalledTimes(1);
      expect(accountDataSource.createAccount).toHaveBeenCalledWith({
        createAccountDto,
        clientIp: expect.any(String),
      });
    });

    it('should propagate errors', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const createAccountDto = createAccountDtoBuilder()
        .with('address', address)
        .build();
      accountDataSource.createAccount.mockRejectedValue(
        new UnprocessableEntityException('Datasource error'),
      );

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createAccountDto)
        .expect(422);

      accountDataSource.createAccount.mockRejectedValue(
        new ConflictException('Datasource error'),
      );

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createAccountDto)
        .expect(409);

      expect(accountDataSource.createAccount).toHaveBeenCalledTimes(2);
    });
  });

  describe('Get accounts', () => {
    it('should get a single account', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().with('group_id', null).build();
      accountDataSource.getAccount.mockResolvedValue(account);
      const expected: Account = {
        id: account.id.toString(),
        groupId: null,
        address: account.address,
        name: account.name,
      };

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(expected);

      expect(accountDataSource.getAccount).toHaveBeenCalledTimes(1);
      // Check the address was checksummed
      expect(accountDataSource.getAccount).toHaveBeenCalledWith(address);
    });

    it('should get a group account', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const groupId = faker.number.int();
      const account = accountBuilder().with('group_id', groupId).build();
      accountDataSource.getAccount.mockResolvedValue(account);
      const expected: Account = {
        id: account.id.toString(),
        groupId: groupId.toString(),
        address: account.address,
        name: account.name,
      };

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(expected);

      expect(accountDataSource.getAccount).toHaveBeenCalledTimes(1);
      // Check the address was checksummed
      expect(accountDataSource.getAccount).toHaveBeenCalledWith(address);
    });

    it('should propagate errors', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      accountDataSource.getAccount.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404);

      expect(accountDataSource.getAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete accounts', () => {
    it('should delete an account', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const createAccountDto = createAccountDtoBuilder()
        .with('address', address)
        .build();
      accountDataSource.createAccount.mockResolvedValue(account);
      accountDataSource.deleteAccount.mockResolvedValue();

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createAccountDto)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(204);

      expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(1);
      // Check the address was checksummed
      expect(accountDataSource.deleteAccount).toHaveBeenCalledWith(address);
    });

    it('should propagate errors', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      accountDataSource.deleteAccount.mockImplementation(() => {
        throw new Error('test error');
      });

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ address: address.toLowerCase() })
        .expect(500);

      expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Data Types', () => {
    it('should return the data types', async () => {
      const dataTypes = [
        accountDataTypeBuilder().build(),
        accountDataTypeBuilder().build(),
      ];
      accountDataSource.getDataTypes.mockResolvedValue(dataTypes);
      const expected = dataTypes.map((dataType) => ({
        id: dataType.id.toString(),
        name: dataType.name,
        description: dataType.description,
        isActive: dataType.is_active,
      }));

      await request(app.getHttpServer())
        .get(`/v1/accounts/data-types`)
        .expect(200)
        .expect(expected);

      expect(accountDataSource.getDataTypes).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors', async () => {
      accountDataSource.getDataTypes.mockImplementation(() => {
        throw new Error('test error');
      });

      await request(app.getHttpServer())
        .get(`/v1/accounts/data-types`)
        .expect(500);

      expect(accountDataSource.getDataTypes).toHaveBeenCalledTimes(1);
    });
  });

  describe('Upsert account data settings', () => {
    it('should upsert data settings for an account', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const dataTypes = [
        accountDataTypeBuilder().build(),
        accountDataTypeBuilder().build(),
      ];
      const domainAccountDataSettings = [
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', dataTypes[0].id)
          .build(),
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', dataTypes[1].id)
          .build(),
      ];
      const upsertAccountDataSettingsDto =
        upsertAccountDataSettingsDtoBuilder().build();
      accountDataSource.getDataTypes.mockResolvedValue(dataTypes);
      accountDataSource.upsertAccountDataSettings.mockResolvedValue(
        domainAccountDataSettings,
      );

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/data-settings`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(upsertAccountDataSettingsDto)
        .expect(200);

      expect(accountDataSource.upsertAccountDataSettings).toHaveBeenCalledTimes(
        1,
      );
      expect(accountDataSource.upsertAccountDataSettings).toHaveBeenCalledWith({
        address,
        upsertAccountDataSettingsDto,
      });
    });

    it('should accept a empty array of data settings', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/data-settings`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ accountDataSettings: [] })
        .expect(200)
        .expect([]);

      expect(
        accountDataSource.upsertAccountDataSettings,
      ).not.toHaveBeenCalled();
    });

    it('should throw an error if the datasource fails', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      accountDataSource.upsertAccountDataSettings.mockImplementation(() => {
        throw new Error('test error');
      });

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/data-settings`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(upsertAccountDataSettingsDtoBuilder().build())
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });

      expect(accountDataSource.upsertAccountDataSettings).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  describe('Get account data settings', () => {
    it('should get the data settings for an account', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const dataTypes = [
        accountDataTypeBuilder().build(),
        accountDataTypeBuilder().build(),
      ];
      const domainAccountDataSettings = [
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', dataTypes[0].id)
          .build(),
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', dataTypes[1].id)
          .build(),
      ];
      accountDataSource.getDataTypes.mockResolvedValue(dataTypes);
      accountDataSource.getAccountDataSettings.mockResolvedValue(
        domainAccountDataSettings,
      );

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/data-settings`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(accountDataSource.getAccountDataSettings).toHaveBeenCalledTimes(1);
      expect(accountDataSource.getAccountDataSettings).toHaveBeenCalledWith(
        address,
      );
    });

    it('should throw an error if the datasource fails', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      accountDataSource.getAccountDataSettings.mockImplementation(() => {
        throw new Error('test error');
      });

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/data-settings`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });

      expect(accountDataSource.getAccountDataSettings).toHaveBeenCalledTimes(1);
    });
  });
});
