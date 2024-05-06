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
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
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
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { TestEmailApiModule } from '@/datasources/email-api/__tests__/test.email-api.module';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { INestApplication } from '@nestjs/common';
import { accountBuilder } from '@/domain/account/entities/__tests__/account.builder';
import { verificationCodeBuilder } from '@/domain/account/entities/__tests__/verification-code.builder';
import { EmailAddress } from '@/domain/account/entities/account.entity';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';

describe('Email controller save email tests', () => {
  let app: INestApplication;
  let configurationService: jest.MockedObjectDeep<IConfigurationService>;
  let emailApi: jest.MockedObjectDeep<IEmailApi>;
  let accountDataSource: jest.MockedObjectDeep<IAccountDataSource>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let safeConfigUrl: string | undefined;
  let jwtService: IJwtService;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration), EmailControllerModule],
    })
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
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
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    emailApi = moduleFixture.get(IEmailApi);
    accountDataSource = moduleFixture.get(IAccountDataSource);
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
  ])('stores email successfully', async ({ safeAddress }) => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const safe = safeBuilder()
      // Allow test of non-checksummed address by casting
      .with('address', safeAddress as `0x${string}`)
      .build();
    const signerAddress = safe.owners[0];
    const authPayloadDto = authPayloadDtoBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', signerAddress)
      .build();
    const accessToken = jwtService.sign(authPayloadDto);
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        // Schema validation checksums address of Safe
        case `${chain.transactionService}/api/v1/safes/${getAddress(safe.address)}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    accountDataSource.createAccount.mockResolvedValue([
      accountBuilder()
        .with('chainId', chain.chainId)
        .with('emailAddress', new EmailAddress(emailAddress))
        .with('safeAddress', safe.address)
        .with('signer', signerAddress)
        .with('isVerified', false)
        .build(),
      verificationCodeBuilder().build(),
    ]);
    accountDataSource.subscribe.mockResolvedValue([
      {
        key: faker.word.sample(),
        name: faker.word.words(2),
      },
    ]);
    emailApi.createMessage.mockResolvedValue();
    accountDataSource.setEmailVerificationSentDate.mockResolvedValue(
      verificationCodeBuilder().build(),
    );

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safeAddress}/emails`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({
        emailAddress: emailAddress,
        signer: signerAddress,
      })
      .expect(201)
      .expect({});

    expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
    expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
      subject: 'Verification code',
      substitutions: { verificationCode: expect.any(String) },
      template: configurationService.getOrThrow(
        'email.templates.verificationCode',
      ),
      to: [emailAddress],
    });
    expect(accountDataSource.createAccount).toHaveBeenCalledWith({
      chainId: chain.chainId,
      // Should always store the checksummed address
      safeAddress: getAddress(safeAddress),
      emailAddress: new EmailAddress(emailAddress),
      signer: signerAddress,
      code: expect.any(String),
      codeGenerationDate: expect.any(Date),
      unsubscriptionToken: expect.any(String),
    });
    expect(accountDataSource.subscribe).toHaveBeenCalledWith({
      chainId: chain.chainId,
      // should be called with checksummed address
      safeAddress: getAddress(safeAddress),
      signer: signerAddress,
      notificationTypeKey: 'account_recovery',
    });
  });

  it('returns 403 if no token is present', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress: emailAddress,
        signer: signerAddress,
      })
      .expect(403);

    expect(emailApi.createMessage).not.toHaveBeenCalled();
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).not.toHaveBeenCalled();
    expect(accountDataSource.createAccount).not.toHaveBeenCalled();
    expect(accountDataSource.subscribe).not.toHaveBeenCalled();
  });

  it('returns 403 if token is not a valid JWT', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const accessToken = faker.string.alphanumeric();

    expect(() => jwtService.verify(accessToken)).toThrow('jwt malformed');
    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({
        emailAddress: emailAddress,
        signer: signerAddress,
      })
      .expect(403);

    expect(emailApi.createMessage).not.toHaveBeenCalled();
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).not.toHaveBeenCalled();
    expect(accountDataSource.createAccount).not.toHaveBeenCalled();
    expect(accountDataSource.subscribe).not.toHaveBeenCalled();
  });

  it('returns 403 if token is not yet valid', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayloadDto = authPayloadDtoBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', signerAddress)
      .build();
    const notBefore = faker.date.future();
    const accessToken = jwtService.sign(authPayloadDto, {
      notBefore: getSecondsUntil(notBefore),
    });

    expect(() => jwtService.verify(accessToken)).toThrow('jwt not active');
    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({
        emailAddress: emailAddress,
        signer: signerAddress,
      })
      .expect(403);

    expect(emailApi.createMessage).not.toHaveBeenCalled();
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).not.toHaveBeenCalled();
    expect(accountDataSource.createAccount).not.toHaveBeenCalled();
    expect(accountDataSource.subscribe).not.toHaveBeenCalled();
  });

  it('returns 403 if token has expired', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayloadDto = authPayloadDtoBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', signerAddress)
      .build();
    const accessToken = jwtService.sign(authPayloadDto, {
      expiresIn: 0, // Now
    });
    jest.advanceTimersByTime(1_000);

    expect(() => jwtService.verify(accessToken)).toThrow('jwt expired');
    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({
        emailAddress: emailAddress,
        signer: signerAddress,
      })
      .expect(403);

    expect(emailApi.createMessage).not.toHaveBeenCalled();
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).not.toHaveBeenCalled();
    expect(accountDataSource.createAccount).not.toHaveBeenCalled();
    expect(accountDataSource.subscribe).not.toHaveBeenCalled();
  });

  it('returns 403 if signer_address is not a valid Ethereum address', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayloadDto = authPayloadDtoBuilder()
      .with('chain_id', chain.chainId)
      .with('signer_address', faker.string.numeric() as `0x${string}`)
      .build();
    const accessToken = jwtService.sign(authPayloadDto);

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({
        emailAddress: emailAddress,
        signer: signerAddress,
      })
      .expect(403);

    expect(emailApi.createMessage).not.toHaveBeenCalled();
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).not.toHaveBeenCalled();
    expect(accountDataSource.createAccount).not.toHaveBeenCalled();
    expect(accountDataSource.subscribe).not.toHaveBeenCalled();
  });

  it('returns 403 if chain_id is not a valid chain ID', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayloadDto = authPayloadDtoBuilder()
      .with('chain_id', faker.string.alpha())
      .with('signer_address', signerAddress)
      .build();
    const accessToken = jwtService.sign(authPayloadDto);

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({
        emailAddress: emailAddress,
        signer: signerAddress,
      })
      .expect(403);

    expect(emailApi.createMessage).not.toHaveBeenCalled();
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).not.toHaveBeenCalled();
    expect(accountDataSource.createAccount).not.toHaveBeenCalled();
    expect(accountDataSource.subscribe).not.toHaveBeenCalled();
  });

  it('returns 401 if chain_id does not match the request', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayloadDto = authPayloadDtoBuilder()
      .with('chain_id', faker.string.numeric({ exclude: [chain.chainId] }))
      .with('signer_address', signerAddress)
      .build();
    const accessToken = jwtService.sign(authPayloadDto);

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({
        emailAddress: emailAddress,
        signer: signerAddress,
      })
      .expect(401);

    expect(emailApi.createMessage).not.toHaveBeenCalled();
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).not.toHaveBeenCalled();
    expect(accountDataSource.createAccount).not.toHaveBeenCalled();
    expect(accountDataSource.subscribe).not.toHaveBeenCalled();
  });

  it('returns 401 if not an owner of the Safe', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const safe = safeBuilder().build();
    const signerAddress = safe.owners[0];
    const authPayloadDto = authPayloadDtoBuilder()
      .with('chain_id', chain.chainId)
      .build();
    const accessToken = jwtService.sign(authPayloadDto);
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

    expect(() => jwtService.verify(accessToken)).not.toThrow();
    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({
        emailAddress: emailAddress,
        signer: signerAddress,
      })
      .expect(401);

    expect(emailApi.createMessage).not.toHaveBeenCalled();
    expect(
      accountDataSource.setEmailVerificationSentDate,
    ).not.toHaveBeenCalled();
    expect(accountDataSource.createAccount).not.toHaveBeenCalled();
    expect(accountDataSource.subscribe).not.toHaveBeenCalled();
  });
});
