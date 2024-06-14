import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';
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
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { getAddress } from 'viem';
import { getMultiSendCallOnlyDeployment } from '@safe-global/safe-deployments';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import {
  AlertsApiConfigurationModule,
  ALERTS_API_CONFIGURATION_MODULE,
} from '@/datasources/alerts-api/configuration/alerts-api.configuration.module';
import alertsApiConfiguration from '@/datasources/alerts-api/configuration/__tests__/alerts-api.configuration';
import {
  AlertsConfigurationModule,
  ALERTS_CONFIGURATION_MODULE,
} from '@/routes/alerts/configuration/alerts.configuration.module';
import alertsConfiguration from '@/routes/alerts/configuration/__tests__/alerts.configuration';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { Server } from 'net';

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

  describe('/alerts route enabled', () => {
    let app: INestApplication<Server>;
    let signingKey: string;

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
        .overrideModule(JWT_CONFIGURATION_MODULE)
        .useModule(JwtConfigurationModule.register(jwtConfiguration))
        .overrideModule(ALERTS_CONFIGURATION_MODULE)
        .useModule(AlertsConfigurationModule.register(alertsConfiguration))
        .overrideModule(ALERTS_API_CONFIGURATION_MODULE)
        .useModule(
          AlertsApiConfigurationModule.register(alertsApiConfiguration),
        )
        .overrideModule(CacheModule)
        .useModule(TestCacheModule)
        .overrideModule(RequestScopedLoggingModule)
        .useModule(TestLoggingModule)
        .overrideModule(NetworkModule)
        .useModule(TestNetworkModule)
        .overrideModule(EmailApiModule)
        .useModule(TestEmailApiModule)
        .overrideModule(QueuesApiModule)
        .useModule(TestQueuesApiModule)
        .compile();

      configurationService = moduleFixture.get(IConfigurationService);
      signingKey = configurationService.getOrThrow('alerts-route.signingKey');
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

      describe.skip('it notifies about a valid transaction attempt', () => {
        it('notifies about addOwnerWithThreshold attempts', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
          // TODO: Check value of threshold and owner in email
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { threshold, owner } = addOwnerWithThreshold.build();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('notifies about removeOwner attempts', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
          // TODO: Check value of threshold in email
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { threshold } = removeOwner.build();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('notifies about swapOwner attempts', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
          // TODO: Check value of newOwner in email
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { newOwner } = swapOwner.build();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('notifies about changeThreshold attempts', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
          const safe = safeBuilder().with('modules', [delayModifier]).build();

          const changeThreshold = changeThresholdEncoder();
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
          // TODO: Check value of threshold in email
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { threshold } = changeThreshold.build();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('notifies about batched owner management attempts', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
              getAddress(getMultiSendCallOnlyDeployment()!.defaultAddress),
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('notifies about alerts with multiple logs', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

          const chain = chainBuilder().build();
          const delayModifier = getAddress(faker.finance.ethereumAddress());
          const safe = safeBuilder().with('modules', [delayModifier]).build();

          const addOwnerWithThreshold = addOwnerWithThresholdEncoder();
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
          // TODO: Check value of threshold and owner in email
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { threshold, owner } = addOwnerWithThreshold.build();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('notifies multiple emails of a Safe for a single alert', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
          // TODO: Check value of threshold and owner in email
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { threshold, owner } = addOwnerWithThreshold.build();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });
      });

      describe.skip('it notifies about an invalid transaction attempt', () => {
        it('notifies about an invalid transaction attempt', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('notifies about alerts with multiple logs', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('notifies about a batch of a valid and an invalid transaction attempt', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
              getAddress(getMultiSendCallOnlyDeployment()!.defaultAddress),
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('notifies about alerts with multiple logs of a valid and a log of an invalid transaction attempt', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
              getAddress(getMultiSendCallOnlyDeployment()!.defaultAddress),
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('notifies multiple accounts subscribed for recovery alerts of one Safe', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
          // TODO: Check threshold and expected owners in email
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { threshold, owner } = addOwnerWithThreshold.build();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const expectedOwners = [...safe.owners, owner];
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
        });

        it('does not notify if not subscribed for recovery alerts', () => {
          // Intentional fail in case we enable this suite
          // We need to first integrate the email service
          expect(true).toBe(false);

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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const signature = fakeTenderlySignature({
            signingKey,
            alert,
            timestamp,
          });
          // TODO: Check no email sent
        });
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
      let app: INestApplication<Server>;

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
          .overrideModule(CacheModule)
          .useModule(TestCacheModule)
          .overrideModule(RequestScopedLoggingModule)
          .useModule(TestLoggingModule)
          .overrideModule(NetworkModule)
          .useModule(TestNetworkModule)
          .overrideModule(QueuesApiModule)
          .useModule(TestQueuesApiModule)
          .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
      });

      afterAll(async () => {
        await app.close();
      });

      it('returns 404 (Not found) for valid signature/invalid payload', async () => {
        const alert = alertBuilder().build();
        const timestamp = Date.now().toString();
        const signature = fakeTenderlySignature({
          signingKey: faker.string.nanoid(32),
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
