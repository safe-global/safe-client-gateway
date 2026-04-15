// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { FeeServiceApi } from '@/datasources/fee-service-api/fee-service-api.service';
import { faker } from '@faker-js/faker';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { getAddress } from 'viem';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { rawify } from '@/validation/entities/raw.entity';
import { PriceSource } from '@/modules/fees/domain/entities/tx-fees-response.dto';
import { feePreviewTransactionDtoBuilder } from '@/modules/fees/routes/entities/__tests__/fee-preview-transaction.dto.builder';
import {
  txFeesResponseBuilder,
  txDataResponseBuilder,
  pricingContextSnapshotBuilder,
} from '@/modules/fees/domain/entities/__tests__/tx-fees-response.builder';

const mockNetworkService = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockDataSource = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>);

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
    fakeConfigurationService.set('relay.fee', {
      baseUri,
      enabledChainIds: ['1', '137', '8453'],
      feePreviewTtlSeconds: 60,
    });
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      30,
    );

    target = new FeeServiceApi(
      mockDataSource,
      mockNetworkService,
      fakeConfigurationService,
      httpErrorFactory,
    );
  });

  it('should error if baseUri is not defined', () => {
    const emptyConfigService = new FakeConfigurationService();
    emptyConfigService.set('expirationTimeInSeconds.notFound.default', 30);
    const errorFactory = new HttpErrorFactory();

    expect(
      () =>
        new FeeServiceApi(
          mockDataSource,
          mockNetworkService,
          emptyConfigService,
          errorFactory,
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

    it('should call dataSource.post with correct arguments', async () => {
      mockDataSource.post.mockResolvedValueOnce(rawify(mockFeeResponse));

      const result = await target.getRelayFees({
        chainId,
        safeAddress,
        request,
      });

      expect(result).toEqual(mockFeeResponse);
      expect(mockDataSource.post).toHaveBeenCalledWith({
        cacheDir: expect.objectContaining({
          key: expect.stringContaining('relay_fee_preview'),
        }),
        url: `${baseUri}/v1/chains/${chainId}/safes/${safeAddress}/transactions/relay-fees`,
        data: request,
        notFoundExpireTimeSeconds: 30,
        expireTimeSeconds: 60,
      });
    });

    it('should forward errors from dataSource', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(
          `${baseUri}/v1/chains/${chainId}/safes/${safeAddress}/transactions/relay-fees`,
        ),
        { status } as Response,
        { message: 'Unexpected error' },
      );
      mockDataSource.post.mockRejectedValueOnce(error);

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
      expect(target.isPayWithSafeEnabled('42161')).toBe(false);
      expect(target.isPayWithSafeEnabled('10')).toBe(false);
      expect(target.isPayWithSafeEnabled('999999')).toBe(false);
    });
  });
});
