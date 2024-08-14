import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { kilnStatsBuilder } from '@/datasources/staking-api/entities/__tests__/kiln-stats.entity.builder';
import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import { pooledStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/pooled-staking-stats.entity.builder';
import { KilnStakingApi } from '@/datasources/staking-api/kiln-api.service';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { faker } from '@faker-js/faker';

const networkService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);
const mockNetworkService = jest.mocked(networkService);

describe('KilnStakingApi', () => {
  let target: KilnStakingApi;

  let baseUrl: string;
  let apiKey: string;
  let httpErrorFactory: HttpErrorFactory;

  beforeEach(() => {
    jest.resetAllMocks();

    baseUrl = faker.internet.url({ appendSlash: false });
    apiKey = faker.string.hexadecimal({ length: 32 });
    httpErrorFactory = new HttpErrorFactory();
    target = new KilnStakingApi(
      baseUrl,
      apiKey,
      mockNetworkService,
      httpErrorFactory,
    );
  });

  describe('getDeployments', () => {
    it('should return deployments', async () => {
      const deployments = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => deploymentBuilder().build(),
      );
      networkService.get.mockResolvedValue({
        status: 200,
        // Note: Kiln always return { data: T }
        data: {
          data: deployments,
        },
      });

      const actual = await target.getDeployments();

      expect(actual).toBe(deployments);
      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: `${baseUrl}/v1/deployments`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      });
    });

    it('should forward errors', async () => {
      const getDeploymentsUrl = `${baseUrl}/v1/deployments`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getDeploymentsUrl),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );

      await expect(target.getDeployments()).rejects.toThrow(expected);

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: getDeploymentsUrl,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      });
    });
  });

  describe('getNetworkStats', () => {
    it('should return network stats', async () => {
      const networkStats = networkStatsBuilder().build();
      networkService.get.mockResolvedValue({
        status: 200,
        // Note: Kiln always return { data: T }
        data: {
          data: networkStats,
        },
      });

      const actual = await target.getNetworkStats();

      expect(actual).toBe(networkStats);
      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: `${baseUrl}/v1/eth/network-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      });
    });

    it('should forward errors', async () => {
      const getNetworkStatsUrl = `${baseUrl}/v1/eth/network-stats`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getNetworkStatsUrl),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );

      await expect(target.getNetworkStats()).rejects.toThrow(expected);

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: getNetworkStatsUrl,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      });
    });
  });

  describe('getKilnStats', () => {
    it('should return the Kiln stats', async () => {
      const kilnStats = kilnStatsBuilder().build();
      networkService.get.mockResolvedValue({
        status: 200,
        // Note: Kiln always return { data: T }
        data: {
          data: kilnStats,
        },
      });

      const actual = await target.getKilnStats();

      expect(actual).toBe(kilnStats);

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: `${baseUrl}/v1/eth/kiln-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      });
    });

    it('should forward errors', async () => {
      const getKilnStats = `${baseUrl}/v1/eth/kiln-stats`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getKilnStats),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );
      await expect(target.getKilnStats()).rejects.toThrow(expected);

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: getKilnStats,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      });
    });
  });

  describe('getPooledStakingStats', () => {
    it('should return the pooled staking integration', async () => {
      const pooledStakingStats = pooledStakingStatsBuilder().build();
      networkService.get.mockResolvedValue({
        status: 200,
        // Note: Kiln always return { data: T }
        data: {
          data: pooledStakingStats,
        },
      });

      const actual = await target.getPooledStakingStats(
        pooledStakingStats.address,
      );

      expect(actual).toBe(pooledStakingStats);

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: `${baseUrl}/v1/eth/onchain/v2/network-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            integration: pooledStakingStats.address,
          },
        },
      });
    });

    it('should forward errors', async () => {
      const pooledStaking = pooledStakingStatsBuilder().build();
      const getOnChainV2NetworkStatsUrl = `${baseUrl}/v1/eth/onchain/v2/network-stats`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getOnChainV2NetworkStatsUrl),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );
      await expect(
        target.getPooledStakingStats(pooledStaking.address),
      ).rejects.toThrow(expected);

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: getOnChainV2NetworkStatsUrl,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            integration: pooledStaking.address,
          },
        },
      });
    });
  });
});
