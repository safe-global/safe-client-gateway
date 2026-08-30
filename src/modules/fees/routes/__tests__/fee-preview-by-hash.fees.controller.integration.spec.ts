// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import {
  gtfFeesResponseBuilder,
  gtfTxDataBuilder,
} from '@/modules/fees/domain/entities/__tests__/gtf-fees-response.builder';
import type { GtfFeesResponse } from '@/modules/fees/domain/entities/gtf-fees-response.entity';
import { rawify } from '@/validation/entities/raw.entity';

describe('Fees Controller - stored fee quote', () => {
  let app: INestApplication<Server>;
  let feeServiceBaseUri: string;
  let networkService: MockedObject<INetworkService>;
  let cacheService: FakeCacheService;

  const chainId = faker.string.numeric({ length: 3, allowLeadingZeros: false });
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const safeTxHash = faker.string.hexadecimal({
    length: 64,
    casing: 'lower',
  }) as Hex;

  beforeEach(async () => {
    vi.resetAllMocks();

    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      relay: {
        ...baseConfiguration.relay,
        fee: {
          baseUri: faker.internet.url({ appendSlash: false }),
          // Positive so cache writes actually happen: hSet returns early on a
          // non-positive TTL, which would make every cache assertion vacuous.
          feePreviewTtlSeconds: 60,
        },
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
    });

    const configService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    feeServiceBaseUri = configService.getOrThrow('relay.fee.baseUri');
    networkService = moduleFixture.get(NetworkService);
    cacheService = moduleFixture.get(CacheService);
    cacheService.clear();

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  const routeUrl = `/v1/chains/${chainId}/fees/${safeAddress}/preview/${safeTxHash}`;

  const mockStoredQuote = (quote: unknown): void => {
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${feeServiceBaseUri}/v1/fee-snapshots/${safeTxHash}`) {
        return Promise.resolve({ data: rawify(quote), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
  };

  const storedQuote = (): GtfFeesResponse =>
    gtfFeesResponseBuilder()
      .with('safeTxHash', safeTxHash)
      .with(
        'txData',
        gtfTxDataBuilder()
          .with('chainId', chainId)
          .with('safeAddress', safeAddress)
          .build(),
      )
      .build();

  it('should normalize an uppercase hash for the upstream URL and the cache', async () => {
    const upperHash = safeTxHash.toUpperCase().replace('0X', '0x') as Hex;
    mockStoredQuote(storedQuote());

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/fees/${safeAddress}/preview/${upperHash}`)
      .expect(200);

    expect(networkService.get).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${feeServiceBaseUri}/v1/fee-snapshots/${safeTxHash}`,
      }),
    );
    const cacheKey = `${chainId}_gtf_fee_snapshot`;
    expect(
      await cacheService.hGet(new CacheDir(cacheKey, safeTxHash)),
    ).not.toBeNull();
    expect(
      await cacheService.hGet(new CacheDir(cacheKey, upperHash)),
    ).toBeNull();
  });

  it('should return the stored quote including the Safenet fee line', async () => {
    const safenetFeeUsd = faker.number.float({
      min: 0.01,
      max: 10,
      fractionDigits: 2,
    });
    const quote = storedQuote();
    mockStoredQuote({
      ...quote,
      feeBreakdown: {
        ...quote.feeBreakdown,
        safenetFeeUsd,
        // A field this gateway does not declare must not reach the response.
        someFutureFeeUsd: 1.23,
      },
    });

    await request(app.getHttpServer())
      .get(routeUrl)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          txData: {
            chainId,
            safeAddress,
            safeTxGas: quote.txData.safeTxGas,
            baseGas: quote.txData.baseGas,
            gasPrice: quote.txData.gasPrice,
            gasToken: quote.txData.gasToken,
            refundReceiver: quote.txData.refundReceiver,
            numberSignatures: quote.feeBreakdown.numberSignatures,
          },
          feeBreakdown: {
            txValueUsd: quote.feeBreakdown.txValueUsd,
            trailingVolumeUsd: quote.feeBreakdown.trailingVolumeUsd,
            tierBps: quote.feeBreakdown.tierBps,
            gtfFeeUsd: quote.feeBreakdown.gtfFeeUsd,
            relayCostUsd: quote.feeBreakdown.relayCostUsd,
            totalUsd: quote.feeBreakdown.totalUsd,
            numberSignatures: quote.feeBreakdown.numberSignatures,
            valuationDetails: quote.feeBreakdown.valuationDetails,
            safenetFeeUsd,
          },
          maxFeeCapUsd: quote.pricingContextSnapshot.maxFeeCapUsd,
        });
      });
  });

  it('should return 404 when the fee service has no stored quote', async () => {
    networkService.get.mockImplementation(({ url }) =>
      Promise.reject(
        new NetworkResponseError(new URL(url), { status: 404 } as Response, {
          message: 'Fee snapshot not found',
        }),
      ),
    );

    await request(app.getHttpServer()).get(routeUrl).expect(404);
  });

  it.each([
    ['another chain', { chainId: `${chainId}9` }],
    [
      'another Safe',
      { safeAddress: getAddress(faker.finance.ethereumAddress()) },
    ],
  ] as const)(
    'should return 404 when the stored quote is for %s',
    async (_label, scope) => {
      const quote = storedQuote();
      mockStoredQuote({ ...quote, txData: { ...quote.txData, ...scope } });

      await request(app.getHttpServer())
        .get(routeUrl)
        .expect(404)
        .expect(({ body }) => {
          expect(body.message).toBe('Fee quote not found');
        });
    },
  );

  it('should throw a validation error for a hash that is not 32 bytes', async () => {
    const shortHash = faker.string.hexadecimal({
      length: 62,
      casing: 'lower',
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/fees/${safeAddress}/preview/${shortHash}`)
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'custom',
        path: [],
        message: 'Invalid hash',
      });

    expect(networkService.get).not.toHaveBeenCalled();
  });
});
