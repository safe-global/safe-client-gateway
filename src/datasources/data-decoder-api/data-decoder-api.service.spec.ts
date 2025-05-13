import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { DataDecoderApi } from '@/datasources/data-decoder-api/data-decoder-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { dataDecodedBuilder } from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import { contractBuilder } from '@/domain/data-decoder/v2/entities/__tests__/contract.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { rawify } from '@/validation/entities/raw.entity';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>);

describe('DataDecoderApi', () => {
  const baseUrl = faker.internet.url({ appendSlash: false });
  const notFoundExpireTimeSeconds = faker.number.int();
  let target: DataDecoderApi;

  beforeEach(() => {
    jest.resetAllMocks();

    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'safeDataDecoder.baseUri') {
        return baseUrl;
      }
      if (key === 'expirationTimeInSeconds.notFound.default') {
        return notFoundExpireTimeSeconds;
      }
      throw new Error('Unexpected key');
    });
    const httpErrorFactory = new HttpErrorFactory();
    target = new DataDecoderApi(
      mockConfigurationService,
      mockCacheFirstDataSource,
      httpErrorFactory,
    );
  });

  describe('getDataDecoded', () => {
    it('should return the decoded data', async () => {
      const dataDecoded = dataDecodedBuilder().build();
      const to = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const data = faker.string.hexadecimal() as `0x${string}`;
      const getDataDecodedUrl = `${baseUrl}/api/v1/data-decoder`;
      mockCacheFirstDataSource.post.mockImplementation(({ url }) => {
        if (url === getDataDecodedUrl) {
          return Promise.resolve(rawify(dataDecoded));
        }
        throw new Error('Unexpected URL');
      });

      const actual = await target.getDecodedData({ data, to, chainId });

      expect(actual).toStrictEqual(dataDecoded);
      expect(mockCacheFirstDataSource.post).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.post).toHaveBeenCalledWith({
        cacheDir: {
          field: '',
          key: `${chainId}_decoded_data_${data}_${to}`,
        },
        url: getDataDecodedUrl,
        notFoundExpireTimeSeconds,
        data: { chainId, to, data },
      });
    });

    it('should forward an error', async () => {
      const to = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as `0x${string}`;
      const chainId = faker.string.numeric();
      const errorMessage = faker.word.words();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const getDataDecodedUrl = `${baseUrl}/api/v1/data-decoder`;
      mockCacheFirstDataSource.post.mockImplementation(({ url }) => {
        if (url === getDataDecodedUrl) {
          return Promise.reject(
            new NetworkResponseError(
              new URL(getDataDecodedUrl),
              {
                status: statusCode,
              } as Response,
              new Error(errorMessage),
            ),
          );
        }
        throw new Error('Unexpected URL');
      });

      await expect(
        target.getDecodedData({ data, to, chainId }),
      ).rejects.toThrow(expected);

      expect(mockCacheFirstDataSource.post).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.post).toHaveBeenCalledWith({
        cacheDir: {
          field: '',
          key: `${chainId}_decoded_data_${data}_${to}`,
        },
        url: getDataDecodedUrl,
        notFoundExpireTimeSeconds,
        data: { chainId, to, data },
      });
    });
  });

  describe('getContracts', () => {
    it('should return the contracts', async () => {
      const contract = contractBuilder().build();
      const contractPage = pageBuilder().with('results', [contract]).build();
      const getContractsUrl = `${baseUrl}/api/v1/contracts/${contract.address}`;
      mockCacheFirstDataSource.get.mockImplementation(({ url }) => {
        if (url === getContractsUrl) {
          return Promise.resolve(rawify(contractPage));
        }
        throw new Error('Unexpected URL');
      });

      const actual = await target.getContracts({
        address: contract.address,
        chainIds: [contract.chainId],
      });

      expect(actual).toStrictEqual(contractPage);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          field: 'undefined_undefined',
          key: `${contract.chainId}_decoded_data_contracts_${contract.address}`,
        },
        url: getContractsUrl,
        notFoundExpireTimeSeconds,
        networkRequest: {
          params: {
            chain_ids: contract.chainId.toString(),
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should support multiple chain IDs', async () => {
      const contract = contractBuilder().build();
      const chainIds = [
        faker.string.numeric(),
        faker.string.numeric(),
        faker.string.numeric(),
      ];
      const contractPage = pageBuilder().with('results', [contract]).build();
      const getContractsUrl = `${baseUrl}/api/v1/contracts/${contract.address}`;
      mockCacheFirstDataSource.get.mockImplementation(({ url }) => {
        if (url === getContractsUrl) {
          return Promise.resolve(rawify(contractPage));
        }
        throw new Error('Unexpected URL');
      });

      const actual = await target.getContracts({
        address: contract.address,
        chainIds,
      });

      expect(actual).toStrictEqual(contractPage);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          field: 'undefined_undefined',
          key: `${chainIds.sort().join('_')}_decoded_data_contracts_${contract.address}`,
        },
        url: getContractsUrl,
        notFoundExpireTimeSeconds,
        networkRequest: {
          params: {
            chain_ids: `${chainIds[0]}&chain_ids=${chainIds[1]}&chain_ids=${chainIds[2]}`,
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should forward an error', async () => {
      const contract = contractBuilder().build();
      const errorMessage = faker.word.words();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const getContractsUrl = `${baseUrl}/api/v1/contracts/${contract.address}`;
      mockCacheFirstDataSource.get.mockImplementation(({ url }) => {
        if (url === getContractsUrl) {
          return Promise.reject(
            new NetworkResponseError(
              new URL(getContractsUrl),
              {
                status: statusCode,
              } as Response,
              new Error(errorMessage),
            ),
          );
        }
        throw new Error('Unexpected URL');
      });

      await expect(
        target.getContracts({
          address: contract.address,
          chainIds: [contract.chainId],
        }),
      ).rejects.toThrow(expected);

      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          field: 'undefined_undefined',
          key: `${contract.chainId}_decoded_data_contracts_${contract.address}`,
        },
        url: getContractsUrl,
        notFoundExpireTimeSeconds,
        networkRequest: {
          params: {
            chain_ids: contract.chainId.toString(),
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });
  });
});
