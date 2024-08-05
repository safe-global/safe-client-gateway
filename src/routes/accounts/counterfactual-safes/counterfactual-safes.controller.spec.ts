import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountsDataSourceModule } from '@/datasources/accounts/__tests__/test.accounts.datasource.module';
import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { TestCounterfactualSafesDataSourceModule } from '@/datasources/accounts/counterfactual-safes/__tests__/test.counterfactual-safes.datasource.module';
import { CounterfactualSafesDatasourceModule } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { counterfactualSafeBuilder } from '@/domain/accounts/counterfactual-safes/entities/__tests__/counterfactual-safe.builder';
import { createCounterfactualSafeDtoBuilder } from '@/domain/accounts/counterfactual-safes/entities/__tests__/create-counterfactual-safe.dto.entity.builder';
import { accountDataSettingBuilder } from '@/domain/accounts/entities/__tests__/account-data-setting.builder';
import { accountDataTypeBuilder } from '@/domain/accounts/entities/__tests__/account-data-type.builder';
import { accountBuilder } from '@/domain/accounts/entities/__tests__/account.builder';
import { AccountDataTypeNames } from '@/domain/accounts/entities/account-data-type.entity';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { ICounterfactualSafesDatasource } from '@/domain/interfaces/counterfactual-safes.datasource.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { faker } from '@faker-js/faker';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { getAddress } from 'viem';

describe('CounterfactualSafesController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let accountsRepository: jest.MockedObjectDeep<IAccountsRepository>;
  let counterfactualSafesDataSource: jest.MockedObjectDeep<ICounterfactualSafesDatasource>;

  beforeAll(async () => {
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
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .overrideModule(AccountsDatasourceModule)
      .useModule(TestAccountsDataSourceModule)
      .overrideModule(CounterfactualSafesDatasourceModule)
      .useModule(TestCounterfactualSafesDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();
    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    accountsRepository = moduleFixture.get(IAccountsDatasource);
    counterfactualSafesDataSource = moduleFixture.get(
      ICounterfactualSafesDatasource,
    );

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Get Counterfactual Safe', () => {
    it('should return a Counterfactual Safe', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafe = counterfactualSafeBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafe.mockResolvedValue(
        counterfactualSafe,
      );

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({
          chainId: counterfactualSafe.chain_id,
          creator: counterfactualSafe.creator,
          fallbackHandler: counterfactualSafe.fallback_handler,
          owners: counterfactualSafe.owners,
          predictedAddress: counterfactualSafe.predicted_address,
          saltNonce: counterfactualSafe.salt_nonce,
          singletonAddress: counterfactualSafe.singleton_address,
          threshold: counterfactualSafe.threshold,
        });
    });

    it('should fail if the authPayload does not match the URL address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', getAddress(faker.finance.ethereumAddress()))
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${getAddress(faker.finance.ethereumAddress())}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('should fail if the account does not have the CounterfactualSafes data setting enabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .build(),
      ];
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', false)
          .build(),
      ]);

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${getAddress(faker.finance.ethereumAddress())}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(410);
    });

    it('should not propagate a database error', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafe = counterfactualSafeBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafe.mockRejectedValue(
        new Error('Database error.'),
      );

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });
    });

    it('should return a Counterfactual Safe even if the token is associated with a different chain ID', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', faker.string.numeric())
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafe = counterfactualSafeBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafe.mockResolvedValue(
        counterfactualSafe,
      );

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${faker.string.numeric({ exclude: authPayloadDto.chain_id })}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({
          chainId: counterfactualSafe.chain_id,
          creator: counterfactualSafe.creator,
          fallbackHandler: counterfactualSafe.fallback_handler,
          owners: counterfactualSafe.owners,
          predictedAddress: counterfactualSafe.predicted_address,
          saltNonce: counterfactualSafe.salt_nonce,
          singletonAddress: counterfactualSafe.singleton_address,
          threshold: counterfactualSafe.threshold,
        });
    });

    it('returns 403 if no token is present', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const counterfactualSafe = counterfactualSafeBuilder().build();

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if the token is not a valid JWT', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const counterfactualSafe = counterfactualSafeBuilder().build();
      const accessToken = 'invalid';

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 is token it not yet valid', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const counterfactualSafe = counterfactualSafeBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        nbf: faker.date.future(),
      });

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');
      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if token has expired', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const counterfactualSafe = counterfactualSafeBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        exp: faker.date.past(),
      });

      expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');
      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if signer_address is not a valid Ethereum address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const counterfactualSafe = counterfactualSafeBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', faker.string.sample() as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if chain_id is not a valid chain ID', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.lorem.sentence();
      const counterfactualSafe = counterfactualSafeBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', faker.string.sample() as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('should return 404 if the Counterfactual Safe does not exist', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafe = counterfactualSafeBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafe.mockRejectedValue(
        new NotFoundException('Error getting Counterfactual Safe.'),
      );

      await request(app.getHttpServer())
        .get(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404);
    });
  });

  describe('Get Counterfactual Safes', () => {
    it('should return all the Counterfactual Safes associated with the account address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafes = Array.from(
        { length: faker.number.int({ min: 1, max: 4 }) },
        () => counterfactualSafeBuilder().build(),
      );
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafesForAccount.mockResolvedValue(
        counterfactualSafes,
      );

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(
          counterfactualSafes.map((counterfactualSafe) => ({
            chainId: counterfactualSafe.chain_id,
            creator: counterfactualSafe.creator,
            fallbackHandler: counterfactualSafe.fallback_handler,
            owners: counterfactualSafe.owners,
            predictedAddress: counterfactualSafe.predicted_address,
            saltNonce: counterfactualSafe.salt_nonce,
            singletonAddress: counterfactualSafe.singleton_address,
            threshold: counterfactualSafe.threshold,
          })),
        );

      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).toHaveBeenCalledWith(account);
      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).toHaveBeenCalledTimes(1);
    });

    it('should fail if the account does not have the CounterfactualSafes data setting enabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', false)
          .build(),
      ];
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(410);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('should fail if the authPayload does not match the URL address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', getAddress(faker.finance.ethereumAddress()))
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('should not propagate a database error', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafesForAccount.mockRejectedValue(
        new Error('Database error.'),
      );

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });

      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).toHaveBeenCalledWith(account);
      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).toHaveBeenCalledTimes(1);
    });

    it('returns 403 if no token is present', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if the token is not a valid JWT', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const accessToken = 'invalid';

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 is token it not yet valid', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        nbf: faker.date.future(),
      });

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');
      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if token has expired', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        exp: faker.date.past(),
      });

      expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');
      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if signer_address is not a valid Ethereum address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', faker.string.sample() as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if chain_id is not a valid chain ID', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', faker.lorem.sentence())
        .with('signer_address', faker.string.sample() as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('should return an empty array if there are no Counterfactual Safes associated', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafesForAccount.mockResolvedValue(
        [],
      );

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect([]);
    });
  });

  describe('Create Counterfactual Safe', () => {
    it('should get an existent Counterfactual Safe', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafe = counterfactualSafeBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafe.mockResolvedValue(
        counterfactualSafe,
      );
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createCounterfactualSafeDto)
        .expect(200)
        .expect({
          chainId: counterfactualSafe.chain_id,
          creator: counterfactualSafe.creator,
          fallbackHandler: counterfactualSafe.fallback_handler,
          owners: counterfactualSafe.owners,
          predictedAddress: counterfactualSafe.predicted_address,
          saltNonce: counterfactualSafe.salt_nonce,
          singletonAddress: counterfactualSafe.singleton_address,
          threshold: counterfactualSafe.threshold,
        });

      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).toHaveBeenCalledWith({
        account,
        chainId: createCounterfactualSafeDto.chainId,
        predictedAddress: createCounterfactualSafeDto.predictedAddress,
      });
      expect(
        counterfactualSafesDataSource.createCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('should fail if the authPayload does not match the URL address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', getAddress(faker.finance.ethereumAddress()))
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createCounterfactualSafeDto)
        .expect(401);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.createCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('should fail if the account does not have the CounterfactualSafes data setting enabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', false)
          .build(),
      ]);
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createCounterfactualSafeDto)
        .expect(410);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.createCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('should not propagate a database error', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafe.mockRejectedValue(
        new Error('Database error.'),
      );
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createCounterfactualSafeDto)
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });

      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).toHaveBeenCalledWith({
        account,
        chainId: createCounterfactualSafeDto.chainId,
        predictedAddress: createCounterfactualSafeDto.predictedAddress,
      });
    });

    it('should crate a Counterfactual Safe if it does not exist', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafe = counterfactualSafeBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.getCounterfactualSafe.mockRejectedValue(
        new NotFoundException('Error getting Counterfactual Safe.'),
      );
      counterfactualSafesDataSource.createCounterfactualSafe.mockResolvedValue(
        counterfactualSafe,
      );
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createCounterfactualSafeDto)
        .expect(200)
        .expect({
          chainId: counterfactualSafe.chain_id,
          creator: counterfactualSafe.creator,
          fallbackHandler: counterfactualSafe.fallback_handler,
          owners: counterfactualSafe.owners,
          predictedAddress: counterfactualSafe.predicted_address,
          saltNonce: counterfactualSafe.salt_nonce,
          singletonAddress: counterfactualSafe.singleton_address,
          threshold: counterfactualSafe.threshold,
        });

      expect(
        counterfactualSafesDataSource.createCounterfactualSafe,
      ).toHaveBeenCalledWith({
        account,
        createCounterfactualSafeDto,
      });
    });

    it('returns 403 if no token is present', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .send(createCounterfactualSafeDto)
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.createCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if the token is not a valid JWT', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();
      const accessToken = 'invalid';

      expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createCounterfactualSafeDto)
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.createCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 is token it not yet valid', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        nbf: faker.date.future(),
      });

      expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');
      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createCounterfactualSafeDto)
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.createCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if token has expired', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        exp: faker.date.past(),
      });

      expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');
      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createCounterfactualSafeDto)
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.createCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if signer_address is not a valid Ethereum address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', faker.string.sample() as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createCounterfactualSafeDto)
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.createCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if chain_id is not a valid chain ID', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.lorem.sentence();
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .put(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createCounterfactualSafeDto)
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.getCounterfactualSafe,
      ).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.createCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Delete Counterfactual Safe', () => {
    it('should delete a Counterfactual Safe', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafe = counterfactualSafeBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.deleteCounterfactualSafe.mockResolvedValue();

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafe,
      ).toHaveBeenCalledTimes(1);
    });

    it('should fail if the account does not have the CounterfactualSafes data setting enabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];

      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', false)
          .build(),
      ]);

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${getAddress(faker.finance.ethereumAddress())}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(410);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('should fail if the authPayload does not match the URL address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', getAddress(faker.finance.ethereumAddress()))
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${getAddress(faker.finance.ethereumAddress())}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(counterfactualSafesDataSource.deleteCounterfactualSafe).not
        .toHaveBeenCalled;
    });

    it('should not propagate a database error', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafe = counterfactualSafeBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.deleteCounterfactualSafe.mockRejectedValue(
        new Error('Database error.'),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });

      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafe,
      ).toHaveBeenCalledTimes(1);
    });

    it('should delete a Counterfactual Safe even if the token is associated with a different chain ID', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', faker.string.numeric())
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      const counterfactualSafe = counterfactualSafeBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.deleteCounterfactualSafe.mockResolvedValue();

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${faker.string.numeric({ exclude: authPayloadDto.chain_id })}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafe,
      ).toHaveBeenCalledTimes(1);
    });

    it('returns 403 if no token is present', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const counterfactualSafe = counterfactualSafeBuilder().build();

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if the token is not a valid JWT', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const counterfactualSafe = counterfactualSafeBuilder().build();
      const accessToken = 'invalid';

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 is token it not yet valid', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const counterfactualSafe = counterfactualSafeBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        nbf: faker.date.future(),
      });

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');
      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if token has expired', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const counterfactualSafe = counterfactualSafeBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        exp: faker.date.past(),
      });

      expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');
      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if signer_address is not a valid Ethereum address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const counterfactualSafe = counterfactualSafeBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', faker.string.sample() as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${chain.chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if chain_id is not a valid chain ID', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.lorem.sentence();
      const counterfactualSafe = counterfactualSafeBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', faker.string.sample() as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/counterfactual-safes/${chainId}/${counterfactualSafe.predicted_address}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafe,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Delete Counterfactual Safes', () => {
    it('should delete all Counterfactual Safes by account address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.deleteCounterfactualSafesForAccount.mockResolvedValue();

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafesForAccount,
      ).toHaveBeenCalledTimes(1);
    });

    it('should fail if the account does not have the CounterfactualSafes data setting enabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', false)
          .build(),
      ]);

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(410);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('should fail if the authPayload does not match the URL address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', getAddress(faker.finance.ethereumAddress()))
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('should not propagate a database error', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.CounterfactualSafes)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      counterfactualSafesDataSource.deleteCounterfactualSafesForAccount.mockRejectedValue(
        new Error('Database error.'),
      );

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });

      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafesForAccount,
      ).toHaveBeenCalledTimes(1);
    });

    it('returns 403 if no token is present', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/counterfactual-safes`)
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if the token is not a valid JWT', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const accessToken = 'invalid';

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 is token it not yet valid', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        nbf: faker.date.future(),
      });

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');
      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if token has expired', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        exp: faker.date.past(),
      });

      expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');
      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if signer_address is not a valid Ethereum address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', faker.string.sample() as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });

    it('returns 403 if chain_id is not a valid chain ID', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.lorem.sentence();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', faker.string.sample() as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/counterfactual-safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(accountsRepository.getAccount).not.toHaveBeenCalled();
      expect(
        counterfactualSafesDataSource.deleteCounterfactualSafesForAccount,
      ).not.toHaveBeenCalled();
    });
  });
});
