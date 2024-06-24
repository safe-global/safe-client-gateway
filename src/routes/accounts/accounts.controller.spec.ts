import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountsDataSourceModule } from '@/datasources/accounts/__tests__/test.accounts.datasource.module';
import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import jwtConfiguration from '@/datasources/jwt/configuration/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { accountBuilder } from '@/domain/accounts/entities/__tests__/account.builder';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { getSecondsUntil } from '@/domain/common/utils/time';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { faker } from '@faker-js/faker';
import {
  ConflictException,
  INestApplication,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'net';
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
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .overrideModule(AccountsDatasourceModule)
      .useModule(TestAccountsDataSourceModule)
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

  describe('Create accounts', () => {
    it('should create an account', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      accountDataSource.createAccount.mockResolvedValue(account);

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ address: address.toLowerCase() })
        .expect(201);

      expect(accountDataSource.createAccount).toHaveBeenCalledTimes(1);
      // Check the address was checksummed
      expect(accountDataSource.createAccount).toHaveBeenCalledWith(address);
    });

    it('Returns 403 if no token is present', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .send({ address })
        .expect(403);

      expect(accountDataSource.getAccount).not.toHaveBeenCalled();
    });

    it('returns 403 if token is not a valid JWT', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const accessToken = faker.string.sample();

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ address })
        .expect(403);

      expect(accountDataSource.getAccount).not.toHaveBeenCalled();
    });

    it('returns 403 is token it not yet valid', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto, {
        notBefore: getSecondsUntil(faker.date.future()),
      });

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ address })
        .expect(403);

      expect(accountDataSource.getAccount).not.toHaveBeenCalled();
    });

    it('returns 403 if token has expired', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto, { expiresIn: 0 });
      jest.advanceTimersByTime(1_000);

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ address })
        .expect(403);

      expect(accountDataSource.getAccount).not.toHaveBeenCalled();
    });

    it('returns 403 if signer_address is not a valid Ethereum address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', faker.string.hexadecimal() as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ address })
        .expect(403);

      expect(accountDataSource.getAccount).not.toHaveBeenCalled();
    });

    it('returns 403 if chain_id is not a valid chain ID', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', faker.string.alphanumeric())
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ address })
        .expect(403);

      expect(accountDataSource.getAccount).not.toHaveBeenCalled();
    });

    it('should propagate errors', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      accountDataSource.createAccount.mockRejectedValue(
        new UnprocessableEntityException('Datasource error'),
      );

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ address: address.toLowerCase() })
        .expect(422);

      accountDataSource.createAccount.mockRejectedValue(
        new ConflictException('Datasource error'),
      );

      await request(app.getHttpServer())
        .post(`/v1/accounts`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ address: address.toLowerCase() })
        .expect(409);

      expect(accountDataSource.createAccount).toHaveBeenCalledTimes(2);
    });
  });
});
