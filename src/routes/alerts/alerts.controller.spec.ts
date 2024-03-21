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
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { TestEmailApiModule } from '@/datasources/email-api/__tests__/test.email-api.module';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  execTransactionEncoder,
  removeOwnerEncoder,
  swapOwnerEncoder,
} from '@/domain/contracts/__tests__/encoders/safe-encoder.builder';
import { transactionAddedEventBuilder } from '@/domain/alerts/contracts/__tests__/encoders/delay-modifier-encoder.builder';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { getAddress } from 'viem';
import { getMultiSendCallOnlyDeployment } from '@safe-global/safe-deployments';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import { accountBuilder } from '@/domain/account/entities/__tests__/account.builder';
import { EmailAddress } from '@/domain/account/entities/account.entity';
import { subscriptionBuilder } from '@/domain/account/entities/__tests__/subscription.builder';

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
  let configurationService: jest.MockedObjectDeep<IConfigurationService>;
  let emailApi: jest.MockedObjectDeep<IEmailApi>;
  let accountDataSource: jest.MockedObjectDeep<IAccountDataSource>;

  const accountRecoverySubscription = subscriptionBuilder()
    .with('key', 'account_recovery')
    .build();

  describe('/alerts route enabled', () => {
    let app: INestApplication;
    let signingKey: string;
    let networkService: jest.MockedObjectDeep<INetworkService>;
    let safeConfigUrl: string | undefined;
    let webAppBaseUri: string | undefined;

    beforeEach(async () => {
      jest.resetAllMocks();

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
        .overrideModule(AccountDataSourceModule)
        .useModule(TestAccountDataSourceModule)
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
      accountDataSource = moduleFixture.get(IAccountDataSource);
      networkService = moduleFixture.get(NetworkService);
      webAppBaseUri = configurationService.getOrThrow('safeWebApp.baseUri');
      app = await new TestAppProvider().provide(moduleFixture);
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    describe('GET /v1/alerts', () => {
      it('returns 200 (OK) to verify webhook existence', async () => {
        await request(app.getHttpServer()).get('/v1/alerts').expect(200);
      });
    });

    describe('POST /v1/alerts', () => {
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
          .expect(202)
          .expect({});
      });

      describe('it notifies about a valid transaction attempt', () => {
        it('notifies about addOwnerWithThreshold attempts', async () => {
          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
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
          const verifiedAccounts = [
            accountBuilder()
              .with('emailAddress', new EmailAddress(faker.internet.email()))
              .with('isVerified', true)
              .build(),
          ];
          accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
          accountDataSource.getSubscriptions.mockResolvedValue([
            subscriptionBuilder().with('key', 'account_recovery').build(),
          ]);

          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
                return Promise.resolve({
                  data: { safes: [safe.address] },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({ data: safe, status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post('/v1/alerts')
            .set('x-tenderly-signature', signature)
            .set('date', timestamp)
            .send(alert)
            .expect(202)
            .expect({});

          const expectedTargetEmailAddresses = verifiedAccounts.map(
            ({ emailAddress }) => emailAddress.value,
          );
          expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
          expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
            subject: 'Recovery attempt',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              owners: [...safe.owners, owner].map((address) => {
                return {
                  address,
                  explorerUrl: chain.blockExplorerUriTemplate.address.replace(
                    '{{address}}',
                    address,
                  ),
                };
              }),
              threshold: threshold.toString(),
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.recoveryTx',
            ),
            to: expectedTargetEmailAddresses,
          });
        });

        it('notifies about removeOwner attempts', async () => {
          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
          const owners = [
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
          ];
          const safe = safeBuilder()
            .with('owners', owners)
            .with('modules', [delayModifier])
            .build();

          const removeOwner = removeOwnerEncoder(owners).with(
            'owner',
            owners[1],
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
          const verifiedAccounts = [
            accountBuilder()
              .with('emailAddress', new EmailAddress(faker.internet.email()))
              .with('isVerified', true)
              .build(),
          ];
          accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
          accountDataSource.getSubscriptions.mockResolvedValue([
            accountRecoverySubscription,
          ]);

          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
                return Promise.resolve({
                  data: { safes: [safe.address] },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({ data: safe, status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post('/v1/alerts')
            .set('x-tenderly-signature', signature)
            .set('date', timestamp)
            .send(alert)
            .expect(202)
            .expect({});

          const expectedTargetEmailAddresses = verifiedAccounts.map(
            ({ emailAddress }) => emailAddress.value,
          );
          expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
          expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
            subject: 'Recovery attempt',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              owners: [owners[0], owners[2]].map((address) => {
                return {
                  address,
                  explorerUrl: chain.blockExplorerUriTemplate.address.replace(
                    '{{address}}',
                    address,
                  ),
                };
              }),
              threshold: threshold.toString(),
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.recoveryTx',
            ),
            to: expectedTargetEmailAddresses,
          });
        });

        it('notifies about swapOwner attempts', async () => {
          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
          const owners = [
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
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
          const verifiedAccounts = [
            accountBuilder()
              .with('emailAddress', new EmailAddress(faker.internet.email()))
              .with('isVerified', true)
              .build(),
          ];
          accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
          accountDataSource.getSubscriptions.mockResolvedValue([
            accountRecoverySubscription,
          ]);

          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
                return Promise.resolve({
                  data: { safes: [safe.address] },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({ data: safe, status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post('/v1/alerts')
            .set('x-tenderly-signature', signature)
            .set('date', timestamp)
            .send(alert)
            .expect(202)
            .expect({});

          const expectedTargetEmailAddresses = verifiedAccounts.map(
            ({ emailAddress }) => emailAddress.value,
          );
          expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
          expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
            subject: 'Recovery attempt',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              owners: [owners[0], newOwner, owners[2]].map((address) => {
                return {
                  address,
                  explorerUrl: chain.blockExplorerUriTemplate.address.replace(
                    '{{address}}',
                    address,
                  ),
                };
              }),
              threshold: safe.threshold.toString(),
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.recoveryTx',
            ),
            to: expectedTargetEmailAddresses,
          });
        });

        it('notifies about changeThreshold attempts', async () => {
          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
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
          const verifiedAccounts = [
            accountBuilder()
              .with('emailAddress', new EmailAddress(faker.internet.email()))
              .with('isVerified', true)
              .build(),
          ];
          accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
          accountDataSource.getSubscriptions.mockResolvedValue([
            accountRecoverySubscription,
          ]);

          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
                return Promise.resolve({
                  data: { safes: [safe.address] },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({ data: safe, status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post('/v1/alerts')
            .set('x-tenderly-signature', signature)
            .set('date', timestamp)
            .send(alert)
            .expect(202)
            .expect({});

          const expectedTargetEmailAddresses = verifiedAccounts.map(
            ({ emailAddress }) => emailAddress.value,
          );
          expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
          expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
            subject: 'Recovery attempt',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              owners: safe.owners.map((address) => {
                return {
                  address,
                  explorerUrl: chain.blockExplorerUriTemplate.address.replace(
                    '{{address}}',
                    address,
                  ),
                };
              }),
              threshold: threshold.toString(),
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.recoveryTx',
            ),
            to: expectedTargetEmailAddresses,
          });
        });

        it('notifies about batched owner management attempts', async () => {
          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
          const owners = [
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
          ];
          const safe = safeBuilder()
            .with('modules', [delayModifier])
            .with('owners', owners)
            .build();

          const addOwnerWithThreshold = addOwnerWithThresholdEncoder();
          const removeOwner = removeOwnerEncoder(safe.owners)
            .with('owner', owners[0])
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
          const transactionAddedEvent = transactionAddedEventBuilder()
            .with('data', multiSend.encode())
            .with(
              'to',
              getAddress(getMultiSendCallOnlyDeployment()!.defaultAddress!),
            )
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
          const verifiedAccounts = [
            accountBuilder()
              .with('emailAddress', new EmailAddress(faker.internet.email()))
              .with('isVerified', true)
              .build(),
          ];
          accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
          accountDataSource.getSubscriptions.mockResolvedValue([
            accountRecoverySubscription,
          ]);

          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
                return Promise.resolve({
                  data: { safes: [safe.address] },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({ data: safe, status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post('/v1/alerts')
            .set('x-tenderly-signature', signature)
            .set('date', timestamp)
            .send(alert)
            .expect(202)
            .expect({});

          const expectedTargetEmailAddresses = verifiedAccounts.map(
            ({ emailAddress }) => emailAddress.value,
          );
          expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
          expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
            subject: 'Recovery attempt',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              owners: [
                owners[1],
                owners[2],
                addOwnerWithThreshold.build().owner,
              ].map((address) => {
                return {
                  address,
                  explorerUrl: chain.blockExplorerUriTemplate.address.replace(
                    '{{address}}',
                    address,
                  ),
                };
              }),
              threshold: removeOwner.build().threshold.toString(),
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.recoveryTx',
            ),
            to: expectedTargetEmailAddresses,
          });
        });

        it('notifies about alerts with multiple logs', async () => {
          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
          const safe = safeBuilder().with('modules', [delayModifier]).build();

          const addOwnerWithThreshold = addOwnerWithThresholdEncoder();
          const { threshold, owner } = addOwnerWithThreshold.build();
          const transactionAddedEvent = transactionAddedEventBuilder()
            .with('data', addOwnerWithThreshold.encode())
            .with('to', getAddress(safe.address))
            .encode();

          const log = alertLogBuilder()
            .with('address', delayModifier)
            .with('data', transactionAddedEvent.data)
            .with('topics', transactionAddedEvent.topics)
            .build();
          const alert = alertBuilder()
            .with(
              'transaction',
              alertTransactionBuilder()
                .with('to', delayModifier)
                .with('logs', [log, log]) // Multiple logs
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
          const verifiedAccounts = [
            accountBuilder()
              .with('emailAddress', new EmailAddress(faker.internet.email()))
              .with('isVerified', true)
              .build(),
          ];
          accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
          accountDataSource.getSubscriptions.mockResolvedValue([
            accountRecoverySubscription,
          ]);

          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
                return Promise.resolve({
                  data: { safes: [safe.address] },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({ data: safe, status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post('/v1/alerts')
            .set('x-tenderly-signature', signature)
            .set('date', timestamp)
            .send(alert)
            .expect(202)
            .expect({});

          const expectedTargetEmailAddresses = verifiedAccounts.map(
            ({ emailAddress }) => emailAddress.value,
          );
          expect(emailApi.createMessage).toHaveBeenCalledTimes(2);
          expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
            subject: 'Recovery attempt',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              owners: [...safe.owners, owner].map((address) => {
                return {
                  address,
                  explorerUrl: chain.blockExplorerUriTemplate.address.replace(
                    '{{address}}',
                    address,
                  ),
                };
              }),
              threshold: threshold.toString(),
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.recoveryTx',
            ),
            to: expectedTargetEmailAddresses,
          });
          expect(emailApi.createMessage).toHaveBeenNthCalledWith(2, {
            subject: 'Recovery attempt',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              owners: [...safe.owners, owner].map((address) => {
                return {
                  address,
                  explorerUrl: chain.blockExplorerUriTemplate.address.replace(
                    '{{address}}',
                    address,
                  ),
                };
              }),
              threshold: threshold.toString(),
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.recoveryTx',
            ),
            to: expectedTargetEmailAddresses,
          });
        });

        it('notifies multiple emails of a Safe for a single alert', async () => {
          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
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
          const verifiedAccounts = [
            accountBuilder()
              .with('emailAddress', new EmailAddress(faker.internet.email()))
              .with('isVerified', true)
              .build(),
            accountBuilder()
              .with('emailAddress', new EmailAddress(faker.internet.email()))
              .with('isVerified', true)
              .build(),
          ];
          accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
          accountDataSource.getSubscriptions.mockResolvedValue([
            accountRecoverySubscription,
          ]);

          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
                return Promise.resolve({
                  data: { safes: [safe.address] },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({ data: safe, status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post('/v1/alerts')
            .set('x-tenderly-signature', signature)
            .set('date', timestamp)
            .send(alert)
            .expect(202)
            .expect({});

          const expectedOwners = [...safe.owners, owner].map((address) => {
            return {
              address,
              explorerUrl: chain.blockExplorerUriTemplate.address.replace(
                '{{address}}',
                address,
              ),
            };
          });
          expect(emailApi.createMessage).toHaveBeenCalledTimes(2);
          expect(emailApi.createMessage).toHaveBeenCalledWith({
            subject: 'Recovery attempt',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              owners: expectedOwners,
              threshold: threshold.toString(),
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.recoveryTx',
            ),
            to: [verifiedAccounts[0].emailAddress.value],
          });
          expect(emailApi.createMessage).toHaveBeenCalledWith({
            subject: 'Recovery attempt',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              owners: expectedOwners,
              threshold: threshold.toString(),
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[1].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.recoveryTx',
            ),
            to: [verifiedAccounts[1].emailAddress.value],
          });
        });
      });

      describe('it notifies about an invalid transaction attempt', () => {
        it('notifies about an invalid transaction attempt', async () => {
          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
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
          const verifiedAccounts = [
            accountBuilder()
              .with('emailAddress', new EmailAddress(faker.internet.email()))
              .with('isVerified', true)
              .build(),
          ];
          accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
          accountDataSource.getSubscriptions.mockResolvedValue([
            accountRecoverySubscription,
          ]);

          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
                return Promise.resolve({
                  data: { safes: [safe.address] },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({ data: safe, status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post('/v1/alerts')
            .set('x-tenderly-signature', signature)
            .set('date', timestamp)
            .send(alert)
            .expect(202)
            .expect({});

          const expectedTargetEmailAddresses = verifiedAccounts.map(
            ({ emailAddress }) => emailAddress.value,
          );
          expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
          expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
            subject: 'Malicious transaction',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.unknownRecoveryTx',
            ),
            to: expectedTargetEmailAddresses,
          });
        });

        it('notifies about alerts with multiple logs', async () => {
          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
          const safe = safeBuilder().with('modules', [delayModifier]).build();
          const transactionAddedEvent = transactionAddedEventBuilder()
            // Invalid as a) not "direct" owner management or b) batched owner management(s) within MultiSend
            .with('data', execTransactionEncoder().encode())
            .with('to', getAddress(safe.address))
            .encode();

          const log = alertLogBuilder()
            .with('address', delayModifier)
            .with('data', transactionAddedEvent.data)
            .with('topics', transactionAddedEvent.topics)
            .build();
          const alert = alertBuilder()
            .with(
              'transaction',
              alertTransactionBuilder()
                .with('to', delayModifier)
                .with('logs', [log, log]) // Multiple logs
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
          const verifiedAccounts = [
            accountBuilder()
              .with('emailAddress', new EmailAddress(faker.internet.email()))
              .with('isVerified', true)
              .build(),
          ];
          accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
          accountDataSource.getSubscriptions.mockResolvedValue([
            accountRecoverySubscription,
          ]);

          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
                return Promise.resolve({
                  data: { safes: [safe.address] },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({ data: safe, status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post('/v1/alerts')
            .set('x-tenderly-signature', signature)
            .set('date', timestamp)
            .send(alert)
            .expect(202)
            .expect({});

          const expectedTargetEmailAddresses = verifiedAccounts.map(
            ({ emailAddress }) => emailAddress.value,
          );
          expect(emailApi.createMessage).toHaveBeenCalledTimes(2);
          expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
            subject: 'Malicious transaction',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.unknownRecoveryTx',
            ),
            to: expectedTargetEmailAddresses,
          });
          expect(emailApi.createMessage).toHaveBeenNthCalledWith(2, {
            subject: 'Malicious transaction',
            substitutions: {
              webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
              unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
            },
            template: configurationService.getOrThrow(
              'email.templates.unknownRecoveryTx',
            ),
            to: expectedTargetEmailAddresses,
          });
        });
      });

      it('notifies about a batch of a valid and an invalid transaction attempt', async () => {
        const chain = chainBuilder().build();
        const delayModifier = getAddress(faker.finance.ethereumAddress());
        const owners = [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ];
        const safe = safeBuilder()
          .with('modules', [delayModifier])
          .with('owners', owners)
          .build();

        const addOwnerWithThreshold = addOwnerWithThresholdEncoder();
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
            data: execTransactionEncoder().encode(), // Invalid as not owner management call
          },
        ]);
        const multiSend = multiSendEncoder().with(
          'transactions',
          multiSendTransactions,
        );
        const transactionAddedEvent = transactionAddedEventBuilder()
          .with('data', multiSend.encode())
          .with(
            'to',
            getAddress(getMultiSendCallOnlyDeployment()!.defaultAddress!),
          )
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
        const verifiedAccounts = [
          accountBuilder()
            .with('emailAddress', new EmailAddress(faker.internet.email()))
            .with('isVerified', true)
            .build(),
        ];
        accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
        accountDataSource.getSubscriptions.mockResolvedValue([
          accountRecoverySubscription,
        ]);

        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
              return Promise.resolve({
                data: { safes: [safe.address] },
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({ data: safe, status: 200 });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post('/v1/alerts')
          .set('x-tenderly-signature', signature)
          .set('date', timestamp)
          .send(alert)
          .expect(202)
          .expect({});

        const expectedTargetEmailAddresses = verifiedAccounts.map(
          ({ emailAddress }) => emailAddress.value,
        );
        expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
        expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
          subject: 'Malicious transaction',
          substitutions: {
            webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
            unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
          },
          template: configurationService.getOrThrow(
            'email.templates.unknownRecoveryTx',
          ),
          to: expectedTargetEmailAddresses,
        });
      });

      it('notifies about alerts with multiple logs of a valid and a log of an invalid transaction attempt', async () => {
        const chain = chainBuilder().build();
        const delayModifier = getAddress(faker.finance.ethereumAddress());
        const owners = [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ];
        const safe = safeBuilder()
          .with('modules', [delayModifier])
          .with('owners', owners)
          .build();

        const addOwnerWithThreshold = addOwnerWithThresholdEncoder();
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
            data: execTransactionEncoder().encode(), // Invalid as not owner management call
          },
        ]);
        const multiSend = multiSendEncoder().with(
          'transactions',
          multiSendTransactions,
        );
        const transactionAddedEvent = transactionAddedEventBuilder()
          .with('data', multiSend.encode())
          .with(
            'to',
            getAddress(getMultiSendCallOnlyDeployment()!.defaultAddress!),
          )
          .encode();

        const log = alertLogBuilder()
          .with('address', delayModifier)
          .with('data', transactionAddedEvent.data)
          .with('topics', transactionAddedEvent.topics)
          .build();
        const alert = alertBuilder()
          .with(
            'transaction',
            alertTransactionBuilder()
              .with('to', delayModifier)
              .with('logs', [log, log]) // Multiple logs
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
        const verifiedAccounts = [
          accountBuilder()
            .with('emailAddress', new EmailAddress(faker.internet.email()))
            .with('isVerified', true)
            .build(),
        ];
        accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
        accountDataSource.getSubscriptions.mockResolvedValue([
          accountRecoverySubscription,
        ]);

        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
              return Promise.resolve({
                data: { safes: [safe.address] },
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({ data: safe, status: 200 });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post('/v1/alerts')
          .set('x-tenderly-signature', signature)
          .set('date', timestamp)
          .send(alert)
          .expect(202)
          .expect({});

        const expectedTargetEmailAddresses = verifiedAccounts.map(
          ({ emailAddress }) => emailAddress.value,
        );
        expect(emailApi.createMessage).toHaveBeenCalledTimes(2);
        expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
          subject: 'Malicious transaction',
          substitutions: {
            webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
            unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
          },
          template: configurationService.getOrThrow(
            'email.templates.unknownRecoveryTx',
          ),
          to: expectedTargetEmailAddresses,
        });
        expect(emailApi.createMessage).toHaveBeenNthCalledWith(2, {
          subject: 'Malicious transaction',
          substitutions: {
            webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
            unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
          },
          template: configurationService.getOrThrow(
            'email.templates.unknownRecoveryTx',
          ),
          to: expectedTargetEmailAddresses,
        });
      });

      it('notifies multiple email addresses of a Safe', async () => {
        const chain = chainBuilder().build();
        const delayModifier = getAddress(faker.finance.ethereumAddress());
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
        // Multiple emails
        const verifiedAccounts = [
          accountBuilder()
            .with('emailAddress', new EmailAddress(faker.internet.email()))
            .with('isVerified', true)
            .build(),
          accountBuilder()
            .with('emailAddress', new EmailAddress(faker.internet.email()))
            .with('isVerified', true)
            .build(),
        ];
        accountDataSource.getAccounts.mockResolvedValue(verifiedAccounts);
        accountDataSource.getSubscriptions.mockResolvedValue([
          accountRecoverySubscription,
        ]);

        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
              return Promise.resolve({
                data: { safes: [safe.address] },
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({ data: safe, status: 200 });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post('/v1/alerts')
          .set('x-tenderly-signature', signature)
          .set('date', timestamp)
          .send(alert)
          .expect(202)
          .expect({});

        const expectedOwners = [...safe.owners, owner].map((address) => {
          return {
            address,
            explorerUrl: chain.blockExplorerUriTemplate.address.replace(
              '{{address}}',
              address,
            ),
          };
        });
        expect(emailApi.createMessage).toHaveBeenCalledTimes(2);
        expect(emailApi.createMessage).toHaveBeenCalledWith({
          subject: 'Recovery attempt',
          substitutions: {
            webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
            owners: expectedOwners,
            threshold: threshold.toString(),
            unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[0].unsubscriptionToken}`,
          },
          template: configurationService.getOrThrow(
            'email.templates.recoveryTx',
          ),
          to: [verifiedAccounts[0].emailAddress.value],
        });
        expect(emailApi.createMessage).toHaveBeenCalledWith({
          subject: 'Recovery attempt',
          substitutions: {
            webAppUrl: `${webAppBaseUri}/home?safe=${chain.shortName}:${safe.address}`,
            owners: expectedOwners,
            threshold: threshold.toString(),
            unsubscriptionUrl: `${webAppBaseUri}/unsubscribe?token=${verifiedAccounts[1].unsubscriptionToken}`,
          },
          template: configurationService.getOrThrow(
            'email.templates.recoveryTx',
          ),
          to: [verifiedAccounts[1].emailAddress.value],
        });
      });

      it('does not notify accounts not subscribed to CATEGORY_ACCOUNT_RECOVERY', async () => {
        const chain = chainBuilder().build();
        const delayModifier = getAddress(faker.finance.ethereumAddress());
        const safe = safeBuilder().with('modules', [delayModifier]).build();
        const addOwnerWithThreshold = addOwnerWithThresholdEncoder();
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
        const accounts = [
          accountBuilder()
            .with('emailAddress', new EmailAddress(faker.internet.email()))
            .with('isVerified', true)
            .build(),
          accountBuilder()
            .with('emailAddress', new EmailAddress(faker.internet.email()))
            .with('isVerified', true)
            .build(),
        ];
        accountDataSource.getAccounts.mockResolvedValue(accounts);
        accountDataSource.getSubscriptions.mockResolvedValue([
          subscriptionBuilder().build(),
        ]);

        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/modules/${delayModifier}/safes/`:
              return Promise.resolve({
                data: { safes: [safe.address] },
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({ data: safe, status: 200 });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post('/v1/alerts')
          .set('x-tenderly-signature', signature)
          .set('date', timestamp)
          .send(alert)
          .expect(202)
          .expect({});

        expect(emailApi.createMessage).toHaveBeenCalledTimes(0);
      });

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
          .expect(422)
          .expect({
            statusCode: 422,
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['id'],
            message: 'Required',
          });
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
        jest.resetAllMocks();

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
          .overrideModule(AccountDataSourceModule)
          .useModule(TestAccountDataSourceModule)
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
});
