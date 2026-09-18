// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import type { BlockaidScanResponse } from '@/modules/safe-shield/threat-analysis/blockaid/schemas/blockaid-scan-response.schema';
import { rawify } from '@/validation/entities/raw.entity';
import {
  counterpartyAnalysisRequestDtoBuilder,
  threatAnalysisRequestBuilder,
} from './entities/__tests__/builders/analysis-requests.builder';
import { TestBlockaidApiModule } from './threat-analysis/blockaid/__tests__/test.blockaid-api.module';
import { FF_RISK_MITIGATION } from './threat-analysis/blockaid/blockaid-api.constants';
import { IBlockaidApi } from './threat-analysis/blockaid/blockaid-api.interface';
import { BlockaidApiModule } from './threat-analysis/blockaid/blockaid-api.module';

describe('SafeShieldController', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: MockedObject<INetworkService>;
  let blockaidApi: MockedObject<IBlockaidApi>;

  async function initApp(config: typeof configuration): Promise<void> {
    await app?.close();

    const moduleFixture: TestingModule = await createTestModule({
      config,
      modules: [
        {
          originalModule: BlockaidApiModule,
          testModule: TestBlockaidApiModule,
        },
      ],
    });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);
    blockaidApi = moduleFixture.get(IBlockaidApi);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  }

  beforeEach(async () => {
    vi.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
      },
    });

    await initApp(testConfiguration);
  });

  afterEach(async () => {
    await app?.close();
  });

  function rejectAllNetworkCalls(): void {
    networkService.get.mockImplementation(({ url }) =>
      Promise.reject(new Error(`No matching rule for url: ${url}`)),
    );
  }

  describe('POST /v1/chains/:chainId/security/:safeAddress/threat-analysis', () => {
    it('should return 422 for invalid request body', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/security/${safeAddress}/threat-analysis`)
        .send({
          data: {},
        })
        .expect(422);
    });

    it('should return 422 for invalid wallet address', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const requestBody = threatAnalysisRequestBuilder().build();

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/security/${safeAddress}/threat-analysis`)
        .send({
          ...requestBody,
          walletAddress: 'invalid-address',
        })
        .expect(422);
    });

    it('should return empty response when Blockaid is not enabled on chain', async () => {
      const chain = chainBuilder().with('features', []).build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const requestBody = threatAnalysisRequestBuilder().build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        return Promise.reject(new Error(`No matching rule for url: ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/security/${safeAddress}/threat-analysis`,
        )
        .send(requestBody)
        .expect(200)
        .expect({});
    });

    it('should return threat analysis when Blockaid is enabled', async () => {
      const chain = chainBuilder()
        .with('features', [FF_RISK_MITIGATION])
        .build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const requestBody = threatAnalysisRequestBuilder().build();
      const requestId = faker.string.uuid();

      const blockaidResponse: BlockaidScanResponse = {
        validation: {
          result_type: 'Benign',
          classification: '',
          reason: '',
          description: '',
          features: [],
        },
        simulation: {
          status: 'Success',
        },
        request_id: requestId,
      };

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        return Promise.reject(new Error(`No matching rule for url: ${url}`));
      });

      blockaidApi.scanTransaction.mockResolvedValue(blockaidResponse);

      const response = await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/security/${safeAddress}/threat-analysis`,
        )
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('THREAT');
      expect(response.body.THREAT).toBeInstanceOf(Array);
      expect(response.body.THREAT[0]).toHaveProperty('type', 'NO_THREAT');
      expect(response.body.THREAT[0]).toHaveProperty('severity', 'OK');
      expect(blockaidApi.scanTransaction).toHaveBeenCalled();
    });

    it('should return FAILED status when Blockaid API errors', async () => {
      const chain = chainBuilder()
        .with('features', [FF_RISK_MITIGATION])
        .build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const requestBody = threatAnalysisRequestBuilder().build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        return Promise.reject(new Error(`No matching rule for url: ${url}`));
      });

      blockaidApi.scanTransaction.mockRejectedValue(
        new Error('Blockaid API error'),
      );

      const response = await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/security/${safeAddress}/threat-analysis`,
        )
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('THREAT');
      expect(response.body.THREAT).toBeInstanceOf(Array);
      expect(response.body.THREAT[0]).toHaveProperty('type', 'FAILED');
      expect(blockaidApi.scanTransaction).toHaveBeenCalled();
    });

    it('should still return 200 when Copilot is disabled on Core', async () => {
      const defaultConfiguration = configuration();
      await initApp(() => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          copilotCoreDisabled: true,
        },
      }));
      const chain = chainBuilder().with('features', []).build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const requestBody = threatAnalysisRequestBuilder().build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        return Promise.reject(new Error(`No matching rule for url: ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/security/${safeAddress}/threat-analysis`,
        )
        .send(requestBody)
        .expect(200)
        .expect({});
    });
  });

  describe('GET /v1/chains/:chainId/security/:safeAddress/recipient/:recipientAddress', () => {
    it('should return 200 today, degrading gracefully when upstream is unavailable', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const recipientAddress = getAddress(faker.finance.ethereumAddress());
      rejectAllNetworkCalls();

      const response = await request(app.getHttpServer())
        .get(
          `/v1/chains/${chainId}/security/${safeAddress}/recipient/${recipientAddress}`,
        )
        .expect(200);

      expect(response.body).toHaveProperty('isSafe', false);
      expect(response.body.RECIPIENT_INTERACTION[0]).toHaveProperty(
        'type',
        'FAILED',
      );
      expect(response.body.RECIPIENT_ACTIVITY[0]).toHaveProperty(
        'type',
        'FAILED',
      );
    });

    it('should return 402 when Copilot is disabled on Core', async () => {
      const defaultConfiguration = configuration();
      await initApp(() => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          copilotCoreDisabled: true,
        },
      }));
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const recipientAddress = getAddress(faker.finance.ethereumAddress());

      const response = await request(app.getHttpServer()).get(
        `/v1/chains/${chainId}/security/${safeAddress}/recipient/${recipientAddress}`,
      );

      expect(response.status).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(response.body).toMatchObject({
        code: 'COPILOT_DISABLED_ON_CORE',
      });
    });
  });

  describe('POST /v1/chains/:chainId/security/:safeAddress/counterparty-analysis', () => {
    it('should return 200 today, degrading gracefully when upstream is unavailable', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const requestBody = counterpartyAnalysisRequestDtoBuilder().build();
      rejectAllNetworkCalls();

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chainId}/security/${safeAddress}/counterparty-analysis`,
        )
        .send(requestBody)
        .expect(200)
        .expect({ recipient: {}, contract: {}, deadlock: {} });
    });

    it('should still return 200 when Copilot is disabled on Core', async () => {
      const defaultConfiguration = configuration();
      await initApp(() => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          copilotCoreDisabled: true,
        },
      }));
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const requestBody = counterpartyAnalysisRequestDtoBuilder().build();
      rejectAllNetworkCalls();

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chainId}/security/${safeAddress}/counterparty-analysis`,
        )
        .send(requestBody)
        .expect(200)
        .expect({ recipient: {}, contract: {}, deadlock: {} });
    });
  });

  describe('POST /v1/chains/:chainId/security/:safeAddress/report-false-result', () => {
    it('should still accept reports when Copilot is disabled on Core', async () => {
      const defaultConfiguration = configuration();
      await initApp(() => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          copilotCoreDisabled: true,
        },
      }));
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      blockaidApi.reportTransaction.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chainId}/security/${safeAddress}/report-false-result`,
        )
        .send({
          event: 'FALSE_POSITIVE',
          request_id: faker.string.uuid(),
          details: faker.lorem.sentence(),
        })
        .expect(200)
        .expect({ success: true });
    });
  });
});
