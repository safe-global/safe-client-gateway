import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import * as crypto from 'crypto';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  alertBuilder,
  alertLogBuilder,
  alertTransactionBuilder,
} from '@/routes/alerts/entities/__tests__/alerts.builder';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Alert, EventType } from '@/routes/alerts/entities/alert.dto.entity';
import { EmailDataSourceModule } from '@/datasources/email/email.datasource.module';
import { TestEmailDatasourceModule } from '@/datasources/email/__tests__/test.email.datasource.module';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { TestEmailApiModule } from '@/datasources/email-api/__tests__/test.email-api.module';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  execTransactionEncoder,
  removeOwnerEncoder,
  swapOwnerEncoder,
} from '@/domain/alerts/__tests__/safe-transactions.encoder';
import { transactionAddedEventBuilder } from '@/domain/alerts/__tests__/delay-modifier.encoder';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { getAddress } from 'viem';
import { getMultiSendCallOnlyDeployment } from '@safe-global/safe-deployments';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/alerts/__tests__/multi-send-transactions.encoder';

// The `x-tenderly-signature` header contains a cryptographic signature. The webhook request signature is
// a HMAC SHA256 hash of concatenated signing secret, request payload, and timestamp, in this order.
// @see https://github.com/Tenderly/tenderly-docs/blob/d836e99fcc22f141a155688128548505b9fcbf9c/alerts/configuring-alert-destinations/configuring-alert-destinations.md?plain=1#L74
function fakeTenderlySignature(args: {
  signingKey: string;
  alert: Alert;
  timestamp: string;
}): string {
  // Create a HMAC SHA256 hash using the signing key
  const hmac = crypto.createHmac('sha256', args.signingKey);

  // Update the hash with the request body using utf8
  hmac.update(JSON.stringify(args.alert), 'utf8');

  // Update the hash with the request timestamp
  // Note: Tenderly timestamps are Go `time.Time` format, e.g.
  // 2023-10-25 08:30:30.386157172 +0000 UTC m=+3512798.196320121
  hmac.update(args.timestamp);

  return hmac.digest('hex');
}

describe('Alerts (Unit)', () => {
  let configurationService;
  let emailApi;
  let emailDataSource;

  describe('/alerts route enabled', () => {
    let app: INestApplication;
    let signingKey: string;
    let networkService;
    let safeConfigUrl;

    beforeEach(async () => {
      jest.clearAllMocks();

      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          email: true,
        },
      });

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule.register(testConfiguration)],
      })
        .overrideModule(EmailDataSourceModule)
        .useModule(TestEmailDatasourceModule)
        .overrideModule(CacheModule)
        .useModule(TestCacheModule)
        .overrideModule(RequestScopedLoggingModule)
        .useModule(TestLoggingModule)
        .overrideModule(NetworkModule)
        .useModule(TestNetworkModule)
        .overrideModule(EmailApiModule)
        .useModule(TestEmailApiModule)
        .compile();

      configurationService = moduleFixture.get(IConfigurationService);
      safeConfigUrl = configurationService.get('safeConfig.baseUri');
      signingKey = configurationService.getOrThrow('alerts.signingKey');
      emailApi = moduleFixture.get(IEmailApi);
      emailDataSource = moduleFixture.get(IEmailDataSource);
      networkService = moduleFixture.get(NetworkService);

      app = await new TestAppProvider().provide(moduleFixture);
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 200 (OK) for valid signature/valid payload', async () => {
      const alert = alertBuilder().build();
      const timestamp = Date.now().toString();
      const signature = fakeTenderlySignature({
        signingKey,
        alert,
        timestamp,
      });

      await request(app.getHttpServer())
        .post('/v1/alerts')
        .set('x-tenderly-signature', signature)
        .set('date', timestamp)
        .send(alert)
        .expect(200)
        .expect({});
    });

    describe('it notifies about a valid transaction attempt', () => {
      it('notifies about addOwnerWithThreshold attempts', async () => {
        const chain = chainBuilder().build();
        const delayModifier = faker.finance.ethereumAddress();
        const safe = safeBuilder().with('modules', [delayModifier]).build();

        const addOwnerWithThreshold = addOwnerWithThresholdEncoder();
        const { threshold, owner } = addOwnerWithThreshold.build();
        const transactionAddedEvent = transactionAddedEventBuilder()
          .with('data', addOwnerWithThreshold.encode())
          .with('to', getAddress(safe.address))
          .encode();

        const alert = alertBuilder()
          .with(
            'transaction',
            alertTransactionBuilder()
              .with('to', delayModifier)
              .with('logs', [
                alertLogBuilder()
                  .with('address', delayModifier)
                  .with('data', transactionAddedEvent.data)
                  .with('topics', transactionAddedEvent.topics)
                  .build(),
              ])
              .with('network', chain.chainId)
              .build(),
          )
          .with('event_type', EventType.ALERT)
          .build();
        const timestamp = Date.now().toString();
        const signature = fakeTenderlySignature({
          signingKey,
          alert,
          timestamp,
        });
        const verifiedSignerEmails = [{ email: faker.internet.email() }];
        emailDataSource.getVerifiedAccountEmailsBySafeAddress.mockResolvedValue(
          verifiedSignerEmails,
        );

        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${getAddress(
              safe.address,
            )}`:
              return Promise.resolve({ data: safe });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post('/v1/alerts')
          .set('x-tenderly-signature', signature)
          .set('date', timestamp)
          .send(alert)
          .expect(200)
          .expect({});

        const expectedTargetEmailAddresses = verifiedSignerEmails.map(
          ({ email }) => email,
        );
        expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
        expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
          subject: 'Recovery attempt',
          substitutions: {
            owners: JSON.stringify([...safe.owners, owner]),
            threshold: threshold.toString(),
          },
          template: configurationService.getOrThrow(
            'email.templates.recoveryTx',
          ),
          to: expectedTargetEmailAddresses,
        });
      });

      it('notifies about removeOwner attempts', async () => {
        const chain = chainBuilder().build();
        const delayModifier = faker.finance.ethereumAddress();
        const owners = [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ];
        const safe = safeBuilder()
          .with('owners', owners)
          .with('modules', [delayModifier])
          .build();

        const removeOwner = removeOwnerEncoder(owners).with(
          'owner',
          getAddress(owners[1]),
        );
        const { threshold } = removeOwner.build();
        const transactionAddedEvent = transactionAddedEventBuilder()
          .with('data', removeOwner.encode())
          .with('to', getAddress(safe.address))
          .encode();

        const alert = alertBuilder()
          .with(
            'transaction',
            alertTransactionBuilder()
              .with('to', delayModifier)
              .with('logs', [
                alertLogBuilder()
                  .with('address', delayModifier)
                  .with('data', transactionAddedEvent.data)
                  .with('topics', transactionAddedEvent.topics)
                  .build(),
              ])
              .with('network', chain.chainId)
              .build(),
          )
          .with('event_type', EventType.ALERT)
          .build();
        const timestamp = Date.now().toString();
        const signature = fakeTenderlySignature({
          signingKey,
          alert,
          timestamp,
        });
        const verifiedSignerEmails = [{ email: faker.internet.email() }];
        emailDataSource.getVerifiedAccountEmailsBySafeAddress.mockResolvedValue(
          verifiedSignerEmails,
        );

        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${getAddress(
              safe.address,
            )}`:
              return Promise.resolve({ data: safe });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post('/v1/alerts')
          .set('x-tenderly-signature', signature)
          .set('date', timestamp)
          .send(alert)
          .expect(200)
          .expect({});

        const expectedTargetEmailAddresses = verifiedSignerEmails.map(
          ({ email }) => email,
        );
        expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
        expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
          subject: 'Recovery attempt',
          substitutions: {
            owners: JSON.stringify([owners[0], owners[2]]),
            threshold: threshold.toString(),
          },
          template: configurationService.getOrThrow(
            'email.templates.recoveryTx',
          ),
          to: expectedTargetEmailAddresses,
        });
      });

      it('notifies about swapOwner attempts', async () => {
        const chain = chainBuilder().build();
        const delayModifier = faker.finance.ethereumAddress();
        const owners = [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ];
        const safe = safeBuilder()
          .with('owners', owners)
          .with('modules', [delayModifier])
          .build();

        const swapOwner = swapOwnerEncoder(owners)
          .with('oldOwner', getAddress(owners[1]))
          .with('newOwner', getAddress(faker.finance.ethereumAddress()));
        const { newOwner } = swapOwner.build();
        const transactionAddedEvent = transactionAddedEventBuilder()
          .with('data', swapOwner.encode())
          .with('to', getAddress(safe.address))
          .encode();

        const alert = alertBuilder()
          .with(
            'transaction',
            alertTransactionBuilder()
              .with('to', delayModifier)
              .with('logs', [
                alertLogBuilder()
                  .with('address', delayModifier)
                  .with('data', transactionAddedEvent.data)
                  .with('topics', transactionAddedEvent.topics)
                  .build(),
              ])
              .with('network', chain.chainId)
              .build(),
          )
          .with('event_type', EventType.ALERT)
          .build();
        const timestamp = Date.now().toString();
        const signature = fakeTenderlySignature({
          signingKey,
          alert,
          timestamp,
        });
        const verifiedSignerEmails = [{ email: faker.internet.email() }];
        emailDataSource.getVerifiedAccountEmailsBySafeAddress.mockResolvedValue(
          verifiedSignerEmails,
        );

        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${getAddress(
              safe.address,
            )}`:
              return Promise.resolve({ data: safe });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post('/v1/alerts')
          .set('x-tenderly-signature', signature)
          .set('date', timestamp)
          .send(alert)
          .expect(200)
          .expect({});

        const expectedTargetEmailAddresses = verifiedSignerEmails.map(
          ({ email }) => email,
        );
        expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
        expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
          subject: 'Recovery attempt',
          substitutions: {
            owners: JSON.stringify([owners[0], newOwner, owners[2]]),
            threshold: safe.threshold.toString(),
          },
          template: configurationService.getOrThrow(
            'email.templates.recoveryTx',
          ),
          to: expectedTargetEmailAddresses,
        });
      });

      it('notifies about changeThreshold attempts', async () => {
        const chain = chainBuilder().build();
        const delayModifier = faker.finance.ethereumAddress();
        const safe = safeBuilder().with('modules', [delayModifier]).build();

        const changeThreshold = changeThresholdEncoder();
        const { threshold } = changeThreshold.build();
        const transactionAddedEvent = transactionAddedEventBuilder()
          .with('data', changeThreshold.encode())
          .with('to', getAddress(safe.address))
          .encode();

        const alert = alertBuilder()
          .with(
            'transaction',
            alertTransactionBuilder()
              .with('to', delayModifier)
              .with('logs', [
                alertLogBuilder()
                  .with('address', delayModifier)
                  .with('data', transactionAddedEvent.data)
                  .with('topics', transactionAddedEvent.topics)
                  .build(),
              ])
              .with('network', chain.chainId)
              .build(),
          )
          .with('event_type', EventType.ALERT)
          .build();
        const timestamp = Date.now().toString();
        const signature = fakeTenderlySignature({
          signingKey,
          alert,
          timestamp,
        });
        const verifiedSignerEmails = [{ email: faker.internet.email() }];
        emailDataSource.getVerifiedAccountEmailsBySafeAddress.mockResolvedValue(
          verifiedSignerEmails,
        );

        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${getAddress(
              safe.address,
            )}`:
              return Promise.resolve({ data: safe });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post('/v1/alerts')
          .set('x-tenderly-signature', signature)
          .set('date', timestamp)
          .send(alert)
          .expect(200)
          .expect({});

        const expectedTargetEmailAddresses = verifiedSignerEmails.map(
          ({ email }) => email,
        );
        expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
        expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
          subject: 'Recovery attempt',
          substitutions: {
            owners: JSON.stringify(safe.owners),
            threshold: threshold.toString(),
          },
          template: configurationService.getOrThrow(
            'email.templates.recoveryTx',
          ),
          to: expectedTargetEmailAddresses,
        });
      });

      it('notifies about batched owner management attempts', async () => {
        const chain = chainBuilder().build();
        const delayModifier = faker.finance.ethereumAddress();
        const owners = [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ];
        const safe = safeBuilder()
          .with('modules', [delayModifier])
          .with('owners', owners)
          .build();

        const addOwnerWithThreshold = addOwnerWithThresholdEncoder();
        const removeOwner = removeOwnerEncoder(safe.owners)
          .with('owner', getAddress(owners[0]))
          .with('threshold', faker.number.bigInt());
        const multiSendTransactions = multiSendTransactionsEncoder([
          {
            operation: 0,
            to: getAddress(safe.address),
            value: BigInt(0),
            data: addOwnerWithThreshold.encode(),
          },
          {
            operation: 0,
            to: getAddress(safe.address),
            value: BigInt(0),
            data: removeOwner.encode(),
          },
        ]);
        const multiSend = multiSendEncoder().with(
          'transactions',
          multiSendTransactions,
        );
        const execTransaction = execTransactionEncoder()
          .with('data', multiSend.encode())
          .with(
            'to',
            getAddress(getMultiSendCallOnlyDeployment()!.defaultAddress!),
          );
        const transactionAddedEvent = transactionAddedEventBuilder()
          .with('data', execTransaction.encode())
          .with('to', getAddress(safe.address))
          .encode();

        const alert = alertBuilder()
          .with(
            'transaction',
            alertTransactionBuilder()
              .with('to', delayModifier)
              .with('logs', [
                alertLogBuilder()
                  .with('address', delayModifier)
                  .with('data', transactionAddedEvent.data)
                  .with('topics', transactionAddedEvent.topics)
                  .build(),
              ])
              .with('network', chain.chainId)
              .build(),
          )
          .with('event_type', EventType.ALERT)
          .build();
        const timestamp = Date.now().toString();
        const signature = fakeTenderlySignature({
          signingKey,
          alert,
          timestamp,
        });
        const verifiedSignerEmails = [{ email: faker.internet.email() }];
        emailDataSource.getVerifiedAccountEmailsBySafeAddress.mockResolvedValue(
          verifiedSignerEmails,
        );

        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain });
            case `${chain.transactionService}/api/v1/safes/${getAddress(
              safe.address,
            )}`:
              return Promise.resolve({ data: safe });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post('/v1/alerts')
          .set('x-tenderly-signature', signature)
          .set('date', timestamp)
          .send(alert)
          .expect(200)
          .expect({});

        const expectedTargetEmailAddresses = verifiedSignerEmails.map(
          ({ email }) => email,
        );
        expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
        expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
          subject: 'Recovery attempt',
          substitutions: {
            owners: JSON.stringify([
              owners[1],
              owners[2],
              addOwnerWithThreshold.build().owner,
            ]),
            threshold: removeOwner.build().threshold.toString(),
          },
          template: configurationService.getOrThrow(
            'email.templates.recoveryTx',
          ),
          to: expectedTargetEmailAddresses,
        });
      });

      it.todo('notifies about alerts with multiple logs');

      it.todo('notifies multiple emails of a Safe for a single alert');
    });

    describe('it notifies about an invalid transaction attempt', () => {
      it('notifies about an invalid transaction attempt', async () => {
        const delayModifier = faker.finance.ethereumAddress();
        const safe = safeBuilder().with('modules', [delayModifier]).build();
        const transactionAddedEvent = transactionAddedEventBuilder()
          // Invalid as a) not "direct" owner management or b) batched owner management(s) within MultiSend
          .with('data', execTransactionEncoder().encode())
          .with('to', getAddress(safe.address))
          .encode();

        const alert = alertBuilder()
          .with(
            'transaction',
            alertTransactionBuilder()
              .with('to', delayModifier)
              .with('logs', [
                alertLogBuilder()
                  .with('address', delayModifier)
                  .with('data', transactionAddedEvent.data)
                  .with('topics', transactionAddedEvent.topics)
                  .build(),
              ])
              .build(),
          )
          .with('event_type', EventType.ALERT)
          .build();
        const timestamp = Date.now().toString();
        const signature = fakeTenderlySignature({
          signingKey,
          alert,
          timestamp,
        });
        const verifiedSignerEmails = [{ email: faker.internet.email() }];
        emailDataSource.getVerifiedAccountEmailsBySafeAddress.mockResolvedValue(
          verifiedSignerEmails,
        );

        await request(app.getHttpServer())
          .post('/v1/alerts')
          .set('x-tenderly-signature', signature)
          .set('date', timestamp)
          .send(alert)
          .expect(200)
          .expect({});

        const expectedTargetEmailAddresses = verifiedSignerEmails.map(
          ({ email }) => email,
        );
        expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
        expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
          subject: 'Unknown transaction attempt',
          substitutions: {},
          template: configurationService.getOrThrow(
            'email.templates.unknownRecoveryTx',
          ),
          to: expectedTargetEmailAddresses,
        });
      });

      it.todo('notifies about alerts with multiple logs');
    });

    it.todo(
      'notifies about a batch of a valid and an invalid transaction attempt',
    );
    it.todo(
      'notifies about alerts with multiple a log of a valid and a log of an invalid transaction attempt',
    );

    it.todo('notifies multiple email addresses of a Safe');

    it('returns 400 (Bad Request) for valid signature/invalid payload', async () => {
      const alert = {};
      const timestamp = Date.now().toString();
      const signature = fakeTenderlySignature({
        signingKey,
        alert: alert as Alert,
        timestamp,
      });

      await request(app.getHttpServer())
        .post('/v1/alerts')
        .set('x-tenderly-signature', signature)
        .set('date', timestamp)
        .send(alert)
        .expect(400);
    });

    it('returns 403 (Forbidden) for invalid signature/valid payload', async () => {
      const alert = alertBuilder().build();
      const timestamp = Date.now().toString();
      const signature = faker.string.alphanumeric({ length: 64 });

      await request(app.getHttpServer())
        .post('/v1/alerts')
        .set('x-tenderly-signature', signature)
        .set('date', timestamp)
        .send(alert)
        .expect(403);
    });
  });

  describe('/alerts route disabled', () => {
    let app: INestApplication;
    let signingKey: string;

    beforeEach(async () => {
      jest.clearAllMocks();

      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          email: false,
        },
      });

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule.register(testConfiguration)],
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

      app = moduleFixture.createNestApplication();
      const configurationService = moduleFixture.get(IConfigurationService);
      signingKey = configurationService.getOrThrow('alerts.signingKey');

      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 404 (Not found) for valid signature/invalid payload', async () => {
      const alert = alertBuilder().build();
      const timestamp = Date.now().toString();
      const signature = fakeTenderlySignature({
        signingKey,
        alert,
        timestamp,
      });

      await request(app.getHttpServer())
        .post('/v1/alerts')
        .set('x-tenderly-signature', signature)
        .set('date', timestamp)
        .send(alert)
        .expect(404);
    });
  });
});
