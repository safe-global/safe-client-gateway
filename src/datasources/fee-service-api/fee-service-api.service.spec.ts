// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { FeeServiceApi } from '@/datasources/fee-service-api/fee-service-api.service';
import { faker } from '@faker-js/faker';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { getAddress } from 'viem';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { rawify } from '@/validation/entities/raw.entity';
import { PriceSource } from '@/modules/transactions/domain/entities/relay-fee/tx-fees-response.dto';
import { feePreviewTransactionDtoBuilder } from '@/modules/fees/routes/entities/__tests__/fee-preview-transaction.dto.builder';
import {
  txFeesResponseBuilder,
  txDataResponseBuilder,
  pricingContextSnapshotBuilder,
} from '@/modules/transactions/domain/entities/relay-fee/__tests__/tx-fees-response.builder';

const mockNetworkService = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockCacheService = jest.mocked({
  hGet: jest.fn(),
  hSet: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>);

const mockLoggingService = jest.mocked({
  debug: jest.fn(),
  info: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

describe('FeeServiceApi', () => {
  let target: FeeServiceApi;
  let fakeConfigurationService: FakeConfigurationService;
  let httpErrorFactory: HttpErrorFactory;
  let baseUri: string;

  beforeEach(() => {
    jest.resetAllMocks();

    httpErrorFactory = new HttpErrorFactory();
    fakeConfigurationService = new FakeConfigurationService();
    baseUri = faker.internet.url({ appendSlash: false });

    // Configure relay-fee settings
    fakeConfigurationService.set('relay.fee.baseUri', baseUri);
    fakeConfigurationService.set('relay.fee', {
      baseUri,
      enabledChainIds: ['1', '137', '8453'], // Enable for Ethereum, Polygon, Base
      feePreviewTtlSeconds: 60,
    });

    target = new FeeServiceApi(
      mockNetworkService,
      fakeConfigurationService,
      httpErrorFactory,
      mockCacheService,
      mockLoggingService,
    );
  });

  it('should error if baseUri is not defined', () => {
    const emptyConfigService = new FakeConfigurationService();
    const errorFactory = new HttpErrorFactory();

    expect(
      () =>
        new FeeServiceApi(
          mockNetworkService,
          emptyConfigService,
          errorFactory,
          mockCacheService,
          mockLoggingService,
        ),
    ).toThrow();
  });

  describe('canRelay', () => {
    it('should call the fee service API with correct URL', async () => {
      const chainId = faker.string.numeric();
      const safeTxHash = faker.string.hexadecimal({ length: 64 });

      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify({ canRelay: true }),
      });

      const result = await target.canRelay({
        chainId,
        safeTxHash,
      });

      expect(result).toEqual({ canRelay: true });
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUri}/v1/chains/${chainId}/transactions/${safeTxHash}/can-relay`,
      });
    });

    it('should return canRelay false', async () => {
      const chainId = faker.string.numeric();
      const safeTxHash = faker.string.hexadecimal({ length: 64 });

      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify({ canRelay: false }),
      });

      const result = await target.canRelay({
        chainId,
        safeTxHash,
      });

      expect(result).toEqual({ canRelay: false });
    });

    it('should forward network errors', async () => {
      const chainId = faker.string.numeric();
      const safeTxHash = faker.string.hexadecimal({ length: 64 });
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(
          `${baseUri}/v1/chains/${chainId}/transactions/${safeTxHash}/can-relay`,
        ),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(target.canRelay({ chainId, safeTxHash })).rejects.toThrow(
        new DataSourceError('Internal server error', status),
      );
    });
  });

  describe('getRelayFees', () => {
    const chainId = '1';
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const request = feePreviewTransactionDtoBuilder().build();

    const mockFeeResponse = txFeesResponseBuilder()
      .with(
        'txData',
        txDataResponseBuilder()
          .with('chainId', 1)
          .with('safeAddress', safeAddress)
          .with('gasToken', request.gasToken)
          .with('numberSignatures', request.numberSignatures)
          .build(),
      )
      .with(
        'pricingContextSnapshot',
        pricingContextSnapshotBuilder()
          .with('priceSource', PriceSource.COINGECKO)
          .build(),
      )
      .build();

    it('should return cached response when available', async () => {
      const cachedResponse = JSON.stringify(mockFeeResponse);
      mockCacheService.hGet.mockResolvedValueOnce(cachedResponse);

      const result = await target.getRelayFees({
        chainId,
        safeAddress,
        request,
      });

      expect(result).toEqual(mockFeeResponse);
      expect(mockCacheService.hGet).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining('relay_fee_preview'),
        }),
      );
      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('cache hit'),
      );
      expect(mockNetworkService.post).not.toHaveBeenCalled();
    });

    it('should call API and cache response when cache miss', async () => {
      mockCacheService.hGet.mockResolvedValueOnce(null); // Cache miss
      mockNetworkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify(mockFeeResponse),
      });

      const result = await target.getRelayFees({
        chainId,
        safeAddress,
        request,
      });

      expect(result).toEqual(mockFeeResponse);

      // Verify API call
      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUri}/v1/chains/${chainId}/safes/${safeAddress}/transactions/relay-fees`,
        data: request,
      });

      // Verify caching
      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining('relay_fee_preview'),
        }),
        JSON.stringify(mockFeeResponse),
        60, // TTL
      );

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.stringContaining('fetched and cached'),
      );
    });

    it('should forward network errors', async () => {
      mockCacheService.hGet.mockResolvedValueOnce(null);
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(
          `${baseUri}/v1/chains/${chainId}/safes/${safeAddress}/transactions/relay-fees`,
        ),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(
        target.getRelayFees({
          chainId,
          safeAddress,
          request,
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));
    });
  });

  describe('isPayWithSafeEnabled', () => {
    it('should return true for enabled chain IDs', () => {
      expect(target.isPayWithSafeEnabled('1')).toBe(true);
      expect(target.isPayWithSafeEnabled('137')).toBe(true);
      expect(target.isPayWithSafeEnabled('8453')).toBe(true);
    });

    it('should return false for disabled chain IDs', () => {
      expect(target.isPayWithSafeEnabled('42161')).toBe(false); // Arbitrum
      expect(target.isPayWithSafeEnabled('10')).toBe(false); // Optimism
      expect(target.isPayWithSafeEnabled('999999')).toBe(false); // Non-existent
    });
  });
});
