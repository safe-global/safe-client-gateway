import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';
import { CircuitBreakerKeys } from '@/datasources/circuit-breaker/circuit-breaker.keys';

describe('Owners Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET safes by owner address', () => {
    it(`Success`, async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const transactionApiSafeListResponse = {
        safes: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
      };
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });
      networkService.get.mockResolvedValueOnce({
        data: rawify(transactionApiSafeListResponse),
        status: 200,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          // Validation schema checksums addresses
          safes: transactionApiSafeListResponse.safes.map((safe) =>
            getAddress(safe),
          ),
        });
    });

    it('Failure: Config API fails', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      const error = new NetworkResponseError(
        new URL(
          `${safeConfigUrl}/v1/chains/${chainId}/owners/${ownerAddress}/safes`,
        ),
        {
          status: 500,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/owners/${ownerAddress}/safes`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains/${chainId}`,
      });
    });

    it('Failure: Transaction API fails', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });
      const error = new NetworkResponseError(
        new URL(
          // ValidationPipe checksums ownerAddress param
          `${chainResponse.transactionService}/v1/chains/${chainId}/owners/${getAddress(ownerAddress)}/safes`,
        ),
        {
          status: 500,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/owners/${ownerAddress}/safes`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains/${chainId}`,
      });
      expect(networkService.get).toHaveBeenCalledWith({
        // ValidationPipe checksums ownerAddress param
        url: `${chainResponse.transactionService}/api/v1/owners/${getAddress(ownerAddress)}/safes/`,
        data: undefined,
        networkRequest: {
          timeout: expect.any(Number),
          circuitBreaker: {
            key: CircuitBreakerKeys.getTransactionServiceKey(chainId),
          },
        },
      });
    });

    it('Failure: data validation fails', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const transactionApiSafeListResponse = {
        safes: [
          faker.finance.ethereumAddress(),
          faker.number.int(),
          faker.finance.ethereumAddress(),
        ],
      };
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });
      networkService.get.mockResolvedValueOnce({
        data: rawify(transactionApiSafeListResponse),
        status: 200,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/owners/${ownerAddress}/safes`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });
  });
});
