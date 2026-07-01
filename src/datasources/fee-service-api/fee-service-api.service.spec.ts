// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { FeeServiceApi } from '@/datasources/fee-service-api/fee-service-api.service';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { DataSourceError } from '@/domain/errors/data-source.error';
import {
  pricingContextSnapshotBuilder,
  txDataResponseBuilder,
  txFeesResponseBuilder,
} from '@/modules/fees/domain/entities/__tests__/tx-fees-response.builder';
import { PriceSource } from '@/modules/fees/domain/entities/price-source.entity';
import { feePreviewTransactionDtoBuilder } from '@/modules/fees/routes/entities/__tests__/fee-preview-transaction.dto.builder';
import { rawify } from '@/validation/entities/raw.entity';

const mockNetworkService = vi.mocked({
  get: vi.fn(),
  post: vi.fn(),
} as MockedObject<INetworkService>);

const mockDataSource = vi.mocked({
  get: vi.fn(),
  post: vi.fn(),
} as MockedObject<CacheFirstDataSource>);

describe('FeeServiceApi', () => {
  let target: FeeServiceApi;
  let fakeConfigurationService: FakeConfigurationService;
  let httpErrorFactory: HttpErrorFactory;
  let baseUri: string;

  beforeEach(() => {
    vi.resetAllMocks();

    httpErrorFactory = new HttpErrorFactory();
    fakeConfigurationService = new FakeConfigurationService();
    baseUri = faker.internet.url({ appendSlash: false });

    // Configure relay-fee settings
    fakeConfigurationService.set('relay.fee', {
      baseUri,
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
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;

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
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;

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
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;
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
          .with('chainId', '1')
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
        url: `${baseUri}/v1/chains/${chainId}/safes/${safeAddress}/transactions/relay/fees`,
        data: request,
        notFoundExpireTimeSeconds: 30,
        expireTimeSeconds: 60,
      });
    });

    it('should forward errors from dataSource', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(
          `${baseUri}/v1/chains/${chainId}/safes/${safeAddress}/transactions/relay/fees`,
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
});
