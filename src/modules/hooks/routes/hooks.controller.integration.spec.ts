import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { Server } from 'net';
import { createTestModule } from '@/__tests__/testing-module';

describe('HooksController', () => {
  describe('Feature flag disabled (default)', () => {
    let app: INestApplication<Server>;
    let authToken: string;
    let configurationService: IConfigurationService;

    async function initApp(): Promise<void> {
      const moduleFixture = await createTestModule();

      app = moduleFixture.createNestApplication();

      configurationService = moduleFixture.get(IConfigurationService);
      authToken = configurationService.getOrThrow('auth.token');

      await app.init();
    }

    beforeEach(async () => {
      jest.resetAllMocks();
      await initApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should return 410 if the hook is not CHAIN_UPDATE or SAFE_APPS_UPDATE', async () => {
      const payload = {
        type: 'INCOMING_TOKEN',
        tokenAddress: faker.finance.ethereumAddress(),
        txHash: faker.string.hexadecimal({ length: 32 }),
      };
      const safeAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      const data = {
        address: safeAddress,
        chainId: chainId,
        ...payload,
      };

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(data)
        .expect(410);
    });

    it('should throw an error if authorization is not sent in the request headers', async () => {
      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .send({})
        .expect(403);
    });
  });

  describe('Feature flag enabled (hookHttpPostEvent)', () => {
    let app: INestApplication<Server>;
    let authToken: string;
    let configurationService: IConfigurationService;

    async function initApp(): Promise<void> {
      const defaultConfiguration = configuration();

      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          hookHttpPostEvent: true,
        },
      });
      const moduleFixture = await createTestModule({
        config: testConfiguration,
      });

      app = moduleFixture.createNestApplication();

      configurationService = moduleFixture.get(IConfigurationService);
      authToken = configurationService.getOrThrow('auth.token');

      await app.init();
    }

    beforeEach(async () => {
      jest.resetAllMocks();
      await initApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should not return 410 if the feature flag is enabled', async () => {
      const payload = {
        type: 'INCOMING_TOKEN',
        tokenAddress: faker.finance.ethereumAddress(),
        txHash: faker.string.hexadecimal({ length: 32 }),
      };
      const safeAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      const data = {
        address: safeAddress,
        chainId: chainId,
        ...payload,
      };

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(data)
        .expect(202);
    });

    it('should throw an error if authorization is not sent in the request headers', async () => {
      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .send({})
        .expect(403);
    });
  });
});
