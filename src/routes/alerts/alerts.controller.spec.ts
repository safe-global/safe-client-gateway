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
import { execTransactionEncoder } from '@/domain/alerts/__tests__/safe-transactions.encoder';
import { transactionAddedEventBuilder } from '@/domain/alerts/__tests__/delay-modifier.encoder';

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

      app = moduleFixture.createNestApplication();
      configurationService = moduleFixture.get(IConfigurationService);
      signingKey = configurationService.getOrThrow('alerts.signingKey');
      emailApi = moduleFixture.get(IEmailApi);
      emailDataSource = moduleFixture.get(IEmailDataSource);

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
        .post('/alerts')
        .set('x-tenderly-signature', signature)
        .set('date', timestamp)
        .send(alert)
        .expect(200)
        .expect({});
    });

    it.todo('notifies about addOwnerWithThreshold attempts');
    it.todo('notifies about non-addOwnerWithThreshold attempts');
    it.todo('notifies about alerts with multiple logs');

    it('notifies about an invalid transaction attempt', async () => {
      const recipient = faker.finance.ethereumAddress();
      const delayModifier = faker.finance.ethereumAddress();
      const safe = safeBuilder().with('modules', [delayModifier]).build();
      const transactionAddedEvent = transactionAddedEventBuilder()
        .with('data', execTransactionEncoder().encode())
        .build();

      const alert = alertBuilder()
        .with(
          'transaction',
          alertTransactionBuilder()
            .with('from', safe.address)
            .with('to', recipient)
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
      emailDataSource.getVerifiedSignerEmailsBySafeAddress.mockResolvedValue(
        verifiedSignerEmails,
      );

      await request(app.getHttpServer())
        .post('/alerts')
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

    it('returns 400 (Bad Request) for valid signature/invalid payload', async () => {
      const alert = {};
      const timestamp = Date.now().toString();
      const signature = fakeTenderlySignature({
        signingKey,
        alert: alert as Alert,
        timestamp,
      });

      await request(app.getHttpServer())
        .post('/alerts')
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
        .post('/alerts')
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
        .post('/alerts')
        .set('x-tenderly-signature', signature)
        .set('date', timestamp)
        .send(alert)
        .expect(404);
    });
  });
});
