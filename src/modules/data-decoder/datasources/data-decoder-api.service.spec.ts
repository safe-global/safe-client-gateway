// SPDX-License-Identifier: FSL-1.1-MIT

import { createHash } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CircuitBreakerKeys } from '@/datasources/circuit-breaker/circuit-breaker.keys';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { DataDecoderApi } from '@/modules/data-decoder/datasources/data-decoder-api.service';
import { contractBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import { dataDecodedBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/data-decoded.builder';
import { rawify } from '@/validation/entities/raw.entity';

const mockConfigurationService = vi.mocked({
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>);

const mockCacheFirstDataSource = vi.mocked({
  get: vi.fn(),
  post: vi.fn(),
} as MockedObject<CacheFirstDataSource>);

describe('DataDecoderApi', () => {
  const baseUrl = faker.internet.url({ appendSlash: false });
  const notFoundExpireTimeSeconds = faker.number.int();
  const expireTimeSeconds = faker.number.int();
  const decodedDataExpireTimeSeconds = faker.number.int();
  const decodedDataNotFoundExpireTimeSeconds = faker.number.int();
  const hoodiExpireTimeSeconds = faker.number.int();
  let target: DataDecoderApi;

  beforeEach(() => {
    vi.resetAllMocks();

    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'safeDataDecoder.baseUri') {
        return baseUrl;
      }
      if (key === 'expirationTimeInSeconds.notFound.default') {
        return notFoundExpireTimeSeconds;
      }
      if (key === 'expirationTimeInSeconds.notFound.contract') {
        return notFoundExpireTimeSeconds;
      }
      if (key === 'expirationTimeInSeconds.default') {
        return expireTimeSeconds;
      }
      if (key === 'expirationTimeInSeconds.hoodi') {
        return hoodiExpireTimeSeconds;
      }
      if (key === 'expirationTimeInSeconds.decodedData') {
        return decodedDataExpireTimeSeconds;
      }
      if (key === 'expirationTimeInSeconds.notFound.decodedData') {
        return decodedDataNotFoundExpireTimeSeconds;
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
      const data = faker.string.hexadecimal() as Hex;
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
          key: `${chainId}_decoded_data_v2_${createHash('sha256').update(data).digest('hex')}_${to}`,
        },
        url: getDataDecodedUrl,
        notFoundExpireTimeSeconds: decodedDataNotFoundExpireTimeSeconds,
        expireTimeSeconds: decodedDataExpireTimeSeconds,
        data: { chainId, to, data },
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getDataDecoderServiceKey(),
          },
        },
      });
    });

    it('should forward an error', async () => {
      const to = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
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
          key: `${chainId}_decoded_data_v2_${createHash('sha256').update(data).digest('hex')}_${to}`,
        },
        url: getDataDecodedUrl,
        notFoundExpireTimeSeconds: decodedDataNotFoundExpireTimeSeconds,
        expireTimeSeconds: decodedDataExpireTimeSeconds,
        data: { chainId, to, data },
        networkRequest: {
          circuitBreaker: {
            key: CircuitBreakerKeys.getDataDecoderServiceKey(),
          },
        },
      });
    });

    it('should cache Hoodi decodes with the decoded data TTL', async () => {
      const to = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      mockCacheFirstDataSource.post.mockResolvedValue(
        rawify(dataDecodedBuilder().build()),
      );

      await target.getDecodedData({ data, to, chainId: '560048' });

      expect(mockCacheFirstDataSource.post).toHaveBeenCalledWith(
        expect.objectContaining({
          notFoundExpireTimeSeconds: decodedDataNotFoundExpireTimeSeconds,
          expireTimeSeconds: decodedDataExpireTimeSeconds,
        }),
      );
    });

    it('should use distinct cache keys for different calldata', async () => {
      const to = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const data = faker.string.hexadecimal({ length: 64 }) as Hex;
      const otherData = `${data}00` as Hex;
      mockCacheFirstDataSource.post.mockResolvedValue(
        rawify(dataDecodedBuilder().build()),
      );

      await target.getDecodedData({ data, to, chainId });
      await target.getDecodedData({ data: otherData, to, chainId });

      const [first, second] = mockCacheFirstDataSource.post.mock.calls.map(
        ([args]) => args.cacheDir.key,
      );
      expect(first).not.toBe(second);
    });

    it('should keep the cache key size constant for large calldata', async () => {
      const to = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const data = faker.string.hexadecimal({ length: 50_000 }) as Hex;
      mockCacheFirstDataSource.post.mockResolvedValue(
        rawify(dataDecodedBuilder().build()),
      );

      await target.getDecodedData({ data, to, chainId });

      expect(mockCacheFirstDataSource.post.mock.calls[0][0].cacheDir.key).toBe(
        `${chainId}_decoded_data_v2_${createHash('sha256').update(data).digest('hex')}_${to}`,
      );
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
        chainId: contract.chainId,
      });

      expect(actual).toStrictEqual(contractPage);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          field: '',
          key: `${contract.chainId}_contracts_${contract.address}`,
        },
        url: getContractsUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds,
        networkRequest: {
          params: {
            chain_ids: contract.chainId.toString(),
            limit: undefined,
            offset: undefined,
          },
          circuitBreaker: {
            key: CircuitBreakerKeys.getDataDecoderServiceKey(),
          },
        },
      });
    });

    it('should use the Hoodi TTL for Hoodi contracts', async () => {
      const contract = contractBuilder().build();
      mockCacheFirstDataSource.get.mockResolvedValue(
        rawify(pageBuilder().with('results', [contract]).build()),
      );

      await target.getContracts({
        address: contract.address,
        chainId: '560048',
      });

      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith(
        expect.objectContaining({
          notFoundExpireTimeSeconds: hoodiExpireTimeSeconds,
          expireTimeSeconds: hoodiExpireTimeSeconds,
        }),
      );
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
          chainId: contract.chainId,
        }),
      ).rejects.toThrow(expected);

      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          field: '',
          key: `${contract.chainId}_contracts_${contract.address}`,
        },
        url: getContractsUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds,
        networkRequest: {
          params: {
            chain_ids: contract.chainId.toString(),
            limit: undefined,
            offset: undefined,
          },
          circuitBreaker: {
            key: CircuitBreakerKeys.getDataDecoderServiceKey(),
          },
        },
      });
    });
  });

  describe('getTrustedForDelegateCallContracts', () => {
    it('should return the trusted contracts for delegate call', async () => {
      const contractPage = pageBuilder()
        .with('results', [contractBuilder().build()])
        .build();
      const chainId = faker.string.numeric();
      const limit = faker.number.int({ min: 1, max: 100 });
      const offset = faker.number.int({ min: 0, max: 50 });
      const getTrustedContractsUrl = `${baseUrl}/api/v1/contracts`;

      mockCacheFirstDataSource.get.mockImplementation(({ url }) => {
        if (url === getTrustedContractsUrl) {
          return Promise.resolve(rawify(contractPage));
        }
        throw new Error('Unexpected URL');
      });

      const actual = await target.getTrustedForDelegateCallContracts({
        chainId,
        limit,
        offset,
      });

      expect(actual).toStrictEqual(contractPage);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          field: `${limit}_${offset}`,
          key: `${chainId}_trusted_contracts`,
        },
        url: getTrustedContractsUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds,
        networkRequest: {
          params: {
            chain_ids: chainId,
            trusted_for_delegate_call: true,
            limit,
            offset,
          },
          circuitBreaker: {
            key: CircuitBreakerKeys.getDataDecoderServiceKey(),
          },
        },
      });
    });

    it('should return the trusted contracts without limit and offset', async () => {
      const contractPage = pageBuilder()
        .with('results', [contractBuilder().build()])
        .build();
      const chainId = faker.string.numeric();
      const getTrustedContractsUrl = `${baseUrl}/api/v1/contracts`;

      mockCacheFirstDataSource.get.mockImplementation(({ url }) => {
        if (url === getTrustedContractsUrl) {
          return Promise.resolve(rawify(contractPage));
        }
        throw new Error('Unexpected URL');
      });

      const actual = await target.getTrustedForDelegateCallContracts({
        chainId,
      });

      expect(actual).toStrictEqual(contractPage);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          field: 'undefined_undefined',
          key: `${chainId}_trusted_contracts`,
        },
        url: getTrustedContractsUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds,
        networkRequest: {
          params: {
            chain_ids: chainId,
            trusted_for_delegate_call: true,
            limit: undefined,
            offset: undefined,
          },
          circuitBreaker: {
            key: CircuitBreakerKeys.getDataDecoderServiceKey(),
          },
        },
      });
    });

    it('should forward an error', async () => {
      const chainId = faker.string.numeric();
      const errorMessage = faker.word.words();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const getTrustedContractsUrl = `${baseUrl}/api/v1/contracts`;

      mockCacheFirstDataSource.get.mockImplementation(({ url }) => {
        if (url === getTrustedContractsUrl) {
          return Promise.reject(
            new NetworkResponseError(
              new URL(getTrustedContractsUrl),
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
        target.getTrustedForDelegateCallContracts({ chainId }),
      ).rejects.toThrow(expected);

      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          field: 'undefined_undefined',
          key: `${chainId}_trusted_contracts`,
        },
        url: getTrustedContractsUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds,
        networkRequest: {
          params: {
            chain_ids: chainId,
            trusted_for_delegate_call: true,
            limit: undefined,
            offset: undefined,
          },
          circuitBreaker: {
            key: CircuitBreakerKeys.getDataDecoderServiceKey(),
          },
        },
      });
    });
  });
});
