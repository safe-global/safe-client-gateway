import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { dedicatedStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/dedicated-staking-stats.entity.builder';
import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import { pooledStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/pooled-staking-stats.entity.builder';
import { KilnApi } from '@/datasources/staking-api/kiln-api.service';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { faker } from '@faker-js/faker';
import { defiVaultStatsBuilder } from '@/datasources/staking-api/entities/__tests__/defi-vault-stats.entity.builder';
import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';

const networkService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);
const mockNetworkService = jest.mocked(networkService);

describe('KilnApi', () => {
  let target: KilnApi;

  let baseUrl: string;
  let apiKey: string;
  let httpErrorFactory: HttpErrorFactory;

  beforeEach(() => {
    jest.resetAllMocks();

    baseUrl = faker.internet.url({ appendSlash: false });
    apiKey = faker.string.hexadecimal({ length: 32 });
    httpErrorFactory = new HttpErrorFactory();
    target = new KilnApi(baseUrl, apiKey, mockNetworkService, httpErrorFactory);
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

  describe('getDedicatedStakingStats', () => {
    it('should return the dedicated staking stats', async () => {
      const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
      networkService.get.mockResolvedValue({
        status: 200,
        // Note: Kiln always return { data: T }
        data: {
          data: dedicatedStakingStats,
        },
      });

      const actual = await target.getDedicatedStakingStats();

      expect(actual).toBe(dedicatedStakingStats);

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
      const getDedicatedStakingStats = `${baseUrl}/v1/eth/kiln-stats`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getDedicatedStakingStats),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );
      await expect(target.getDedicatedStakingStats()).rejects.toThrow(expected);

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: getDedicatedStakingStats,
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
      const getPooledStakingStatsUrl = `${baseUrl}/v1/eth/onchain/v2/network-stats`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getPooledStakingStatsUrl),
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
        url: getPooledStakingStatsUrl,
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

  describe('getDefiVaultStats', () => {
    it('should return the defi vault stats', async () => {
      const chainIds = {
        eth: 1,
        arb: 42161,
        bsc: 56,
        matic: 137,
        op: 10,
      };
      const [chain, chain_id] = faker.helpers.arrayElement(
        Object.entries(chainIds) as Array<[keyof typeof chainIds, number]>,
      );
      const defiVaultStats = defiVaultStatsBuilder()
        .with('chain', chain)
        .with('chain_id', chain_id)
        .build();
      networkService.get.mockResolvedValue({
        status: 200,
        // Note: Kiln always return { data: T }
        data: {
          data: [defiVaultStats],
        },
      });

      const actual = await target.getDefiVaultStats({
        chainId: defiVaultStats.chain_id.toString(),
        vault: defiVaultStats.vault,
      });

      expect(actual).toStrictEqual([defiVaultStats]);

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: `${baseUrl}/v1/defi/network-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            vaults: `${defiVaultStats.chain}_${defiVaultStats.vault}`,
          },
        },
      });
    });

    it('should throw if the chainId is not supported by Kiln', async () => {
      const defiVaultStats = defiVaultStatsBuilder()
        // Not Ethereum (1) or Optimism (10)
        .with('chain_id', faker.number.int({ min: 2, max: 9 }))
        .build();

      await expect(
        target.getDefiVaultStats({
          chainId: defiVaultStats.chain_id.toString(),
          vault: defiVaultStats.vault,
        }),
      ).rejects.toThrow();

      expect(networkService.get).not.toHaveBeenCalled();
    });

    it('should forward errors', async () => {
      const chainIds = {
        eth: 1,
        arb: 42161,
        bsc: 56,
        matic: 137,
        op: 10,
      };
      const [chain, chain_id] = faker.helpers.arrayElement(
        Object.entries(chainIds) as Array<[keyof typeof chainIds, number]>,
      );
      const defiVaultStats = defiVaultStatsBuilder()
        .with('chain', chain)
        .with('chain_id', chain_id)
        .build();
      const getDefiVaultStatsUrl = `${baseUrl}/v1/defi/network-stats`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getDefiVaultStatsUrl),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );
      await expect(
        target.getDefiVaultStats({
          chainId: defiVaultStats.chain_id.toString(),
          vault: defiVaultStats.vault,
        }),
      ).rejects.toThrow(expected);

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: getDefiVaultStatsUrl,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            vaults: `${defiVaultStats.chain}_${defiVaultStats.vault}`,
          },
        },
      });
    });
  });

  describe('getStakes', () => {
    it('should return stakes', async () => {
      const validatorsPublicKeys = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => faker.string.hexadecimal({ length: 66 }) as `0x${string}`,
      );
      const stakes = Array.from({ length: validatorsPublicKeys.length }, () =>
        stakeBuilder().build(),
      );
      networkService.get.mockResolvedValue({
        status: 200,
        // Note: Kiln always return { data: T }
        data: {
          data: stakes,
        },
      });

      const actual = await target.getStakes(validatorsPublicKeys);

      expect(actual).toBe(stakes);

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenNthCalledWith(1, {
        url: `${baseUrl}/v1/stakes`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            validators: validatorsPublicKeys,
          },
        },
      });
    });

    // TODO: add error handling tests
  });
});
