import { faker } from '@faker-js/faker';
import { LifiBridgeApi } from '@/datasources/bridge-api/lifi-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { bridgeStatusBuilder } from '@/domain/bridge/entities/__tests__/bridge-status.builder';
import { BridgeNames } from '@/domain/bridge/entities/bridge-name.entity';
import { rawify } from '@/validation/entities/raw.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { bridgeChainPageBuilder } from '@/domain/bridge/entities/__tests__/bridge-chain.builder';
import { type CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { type IConfigurationService } from '@/config/configuration.service.interface';
import { ConfigurationModule } from '@/config/configuration.module';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import configuration from '@/config/entities/__tests__/configuration';
import type { Hash } from 'viem';

const mockNetworkService = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>);

describe('LifiBridgeApi', () => {
  let target: LifiBridgeApi;

  let chainId: string;
  let baseUrl: string;
  let apiKey: string;
  let httpErrorFactory: HttpErrorFactory;
  let configurationService: IConfigurationService;

  beforeEach(async () => {
    jest.resetAllMocks();

    chainId = faker.string.numeric();
    baseUrl = faker.internet.url({ appendSlash: false });
    apiKey = faker.string.uuid();
    httpErrorFactory = new HttpErrorFactory();

    const moduleRef = await Test.createTestingModule({
      imports: [
        TestLoggingModule,
        ConfigurationModule.register(configuration),
        ConfigModule,
        TestPostgresDatabaseModuleV2,
      ],
      providers: [DatabaseMigrator],
    }).compile();

    configurationService = moduleRef.get<ConfigService>(ConfigService);

    target = new LifiBridgeApi(
      chainId,
      baseUrl,
      apiKey,
      mockNetworkService,
      mockCacheFirstDataSource,
      httpErrorFactory,
      configurationService,
    );
  });

  describe('getChains', () => {
    it('should return the chains', async () => {
      const bridgeChainPage = bridgeChainPageBuilder().build();
      mockCacheFirstDataSource.get.mockResolvedValue(rawify(bridgeChainPage));

      const actual = await target.getChains();
      expect(actual).toBe(bridgeChainPage);
    });

    it('should forward errors', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUrl}/v1/chains`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );

      mockCacheFirstDataSource.get.mockRejectedValueOnce(error);

      await expect(target.getChains()).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );
    });
  });

  describe('getStatus', () => {
    it('should return the status', async () => {
      const bridgeStatus = bridgeStatusBuilder().build();
      const txHash = faker.string.hexadecimal({ length: 64 }) as Hash;
      const bridge = faker.helpers.arrayElement(BridgeNames);
      const toChain = faker.string.numeric();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(bridgeStatus),
        status: 200,
      });

      const actual = await target.getStatus({
        txHash,
        bridge,
        toChain,
      });

      expect(actual).toBe(bridgeStatus);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUrl}/v1/status`,
        networkRequest: {
          params: {
            txHash,
            fromChain: chainId,
            toChain,
            bridge,
          },
          headers: {
            'x-lifi-api-key': apiKey,
          },
        },
      });
    });

    it('should forward errors', async () => {
      const txHash = faker.string.hexadecimal({ length: 64 }) as Hash;
      const bridge = faker.helpers.arrayElement(BridgeNames);
      const toChain = faker.string.numeric();
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUrl}/v1/status`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        target.getStatus({
          txHash,
          bridge,
          toChain,
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });
});
