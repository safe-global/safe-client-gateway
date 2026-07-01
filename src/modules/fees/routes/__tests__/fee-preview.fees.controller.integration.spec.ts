// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { relayerBuilder } from '@/modules/chains/domain/entities/__tests__/relayer.builder';
import { gtfFeesResponseBuilder } from '@/modules/fees/domain/entities/__tests__/gtf-fees-response.builder';
import { txFeesResponseBuilder } from '@/modules/fees/domain/entities/__tests__/tx-fees-response.builder';
import { feePreviewTransactionDtoBuilder } from '@/modules/fees/routes/entities/__tests__/fee-preview-transaction.dto.builder';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';
import { rawify } from '@/validation/entities/raw.entity';

describe('Fees Controller', () => {
  let app: INestApplication<Server>;
  let feeServiceBaseUri: string;
  let safeConfigUrl: string;
  let networkService: MockedObject<INetworkService>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      relay: {
        ...baseConfiguration.relay,
        fee: {
          baseUri: faker.internet.url({ appendSlash: false }),
          feePreviewTtlSeconds: 0,
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
    safeConfigUrl = configService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 if relay-fee is not available for the chain', async () => {
    const chain = chainBuilder()
      .with('relayer', relayerBuilder().with('type', null).build())
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/fees/${safeAddress}/preview`)
      .send(feePreviewTransactionDtoBuilder().build())
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe(
          `Accessing fee preview is only available for chains with ${RelayerType.RELAY_FEE} or ${RelayerType.GTF} relayer`,
        );
      });
  });

  it('should throw a validation error for invalid data', async () => {
    const chain = chainBuilder()
      .with(
        'relayer',
        relayerBuilder().with('type', RelayerType.RELAY_FEE).build(),
      )
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/fees/${safeAddress}/preview`)
      .send(
        feePreviewTransactionDtoBuilder()
          .with('to', 'invalid-address' as `0x${string}`)
          .build(),
      )
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'custom',
        path: ['to'],
        message: 'Invalid address',
      });
  });

  it('should return fee preview with relayCost when fee service returns new format', async () => {
    const chain = chainBuilder()
      .with(
        'relayer',
        relayerBuilder().with('type', RelayerType.RELAY_FEE).build(),
      )
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const feePreviewDto = feePreviewTransactionDtoBuilder()
      .with('value', '1000000000000000000')
      .with('fiatCode', 'EUR')
      .build();
    const mockFeeResponse = txFeesResponseBuilder()
      .with('relayCost', { fiatCode: 'EUR', fiatValue: '0.0025' })
      .build();

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    networkService.post.mockImplementation(({ url }) => {
      if (
        url ===
        `${feeServiceBaseUri}/v1/chains/${chain.chainId}/safes/${safeAddress}/transactions/relay/fees`
      ) {
        return Promise.resolve({ data: rawify(mockFeeResponse), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/fees/${safeAddress}/preview`)
      .send(feePreviewDto)
      .expect(200)
      .expect(({ body }) => {
        expect(body.relayCost).toEqual({
          fiatCode: 'EUR',
          fiatValue: '0.0025',
        });
        expect(body.txData).toBeDefined();
      });
  });

  it('should return fee preview with feeBreakdown when chain resolves to the GTF relayer', async () => {
    const chain = chainBuilder()
      .with('relayer', relayerBuilder().with('type', RelayerType.GTF).build())
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const feePreviewDto = feePreviewTransactionDtoBuilder().build();
    const mockGtfFeeResponse = gtfFeesResponseBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    networkService.post.mockImplementation(({ url }) => {
      if (
        url ===
        `${feeServiceBaseUri}/v1/chains/${chain.chainId}/safes/${safeAddress}/transactions/gtf/fees`
      ) {
        return Promise.resolve({
          data: rawify(mockGtfFeeResponse),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/fees/${safeAddress}/preview`)
      .send(feePreviewDto)
      .expect(200)
      .expect(({ body }) => {
        expect(body.safeTxHash).toBeUndefined();
        expect(body.relayCost).toBeUndefined();
        expect(body.feeBreakdown).toEqual({
          txValueUsd: mockGtfFeeResponse.feeBreakdown.txValueUsd,
          trailingVolumeUsd: mockGtfFeeResponse.feeBreakdown.trailingVolumeUsd,
          tierBps: mockGtfFeeResponse.feeBreakdown.tierBps,
          gtfFeeUsd: mockGtfFeeResponse.feeBreakdown.gtfFeeUsd,
          relayCostUsd: mockGtfFeeResponse.feeBreakdown.relayCostUsd,
          totalUsd: mockGtfFeeResponse.feeBreakdown.totalUsd,
          numberSignatures: mockGtfFeeResponse.feeBreakdown.numberSignatures,
          valuationDetails: mockGtfFeeResponse.feeBreakdown.valuationDetails,
        });
        expect(body.maxFeeCapUsd).toBe(
          mockGtfFeeResponse.pricingContextSnapshot.maxFeeCapUsd,
        );
        expect(body.txData).toEqual(
          expect.objectContaining({
            chainId: mockGtfFeeResponse.txData.chainId,
            safeAddress: mockGtfFeeResponse.txData.safeAddress,
            numberSignatures: mockGtfFeeResponse.feeBreakdown.numberSignatures,
          }),
        );
        expect(body.txData.to).toBeUndefined();
        expect(body.txData.nonce).toBeUndefined();
      });
  });

  it('should throw a validation error for invalid numberSignatures', async () => {
    const chain = chainBuilder()
      .with(
        'relayer',
        relayerBuilder().with('type', RelayerType.RELAY_FEE).build(),
      )
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/fees/${safeAddress}/preview`)
      .send(
        feePreviewTransactionDtoBuilder().with('numberSignatures', 0).build(),
      )
      .expect(422)
      .expect(({ body }) => {
        expect(body.code).toBe('too_small');
        expect(body.path).toEqual(['numberSignatures']);
      });
  });
});
