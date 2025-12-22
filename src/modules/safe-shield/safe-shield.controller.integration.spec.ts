import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import request from 'supertest';
import { getAddress } from 'viem';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { threatAnalysisRequestBuilder } from './entities/__tests__/builders/analysis-requests.builder';
import { FF_RISK_MITIGATION } from './threat-analysis/blockaid/blockaid-api.constants';
import { BlockaidApiModule } from './threat-analysis/blockaid/blockaid-api.module';
import { TestBlockaidApiModule } from './threat-analysis/blockaid/__tests__/test.blockaid-api.module';
import { IBlockaidApi } from './threat-analysis/blockaid/blockaid-api.interface';
import type { BlockaidScanResponse } from '@/modules/safe-shield/threat-analysis/blockaid/schemas/blockaid-scan-response.schema';

describe('SafeShieldController (Integration)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let blockaidApi: jest.MockedObjectDeep<IBlockaidApi>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

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
      const mockErrorMessage = 'Blockaid API error';

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        return Promise.reject(new Error(`No matching rule for url: ${url}`));
      });

      blockaidApi.scanTransaction.mockRejectedValue(
        new Error(mockErrorMessage),
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
      expect(response.body.THREAT[0]).toHaveProperty('error', mockErrorMessage);
      expect(blockaidApi.scanTransaction).toHaveBeenCalled();
    });
  });
});
