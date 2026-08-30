// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { relayerBuilder } from '@/modules/chains/domain/entities/__tests__/relayer.builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
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
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  /**
   * Serves the one config-service read the preview makes. Its `features` array
   * carries the Safenet gate.
   */
  const mockChain = (chain: Chain): void => {
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
  };

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
          'Fee preview is not available for this chain',
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

    mockChain(chain);

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

  it('should pass the Safenet fee line through verbatim', async () => {
    const chain = chainBuilder()
      .with('relayer', relayerBuilder().with('type', RelayerType.GTF).build())
      .with('features', ['SAFENET_CHECKS'])
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safenetFeeUsd = faker.number.float({
      min: 0.01,
      max: 10,
      fractionDigits: 2,
    });
    const baseResponse = gtfFeesResponseBuilder().build();
    const mockGtfFeeResponse = {
      ...baseResponse,
      feeBreakdown: {
        ...baseResponse.feeBreakdown,
        safenetFeeUsd,
        // Fields this gateway does not declare must not reach the response.
        safenetFeeSponsored: true,
        someFutureFeeUsd: 1.23,
      },
    };

    mockChain(chain);

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
      .send(feePreviewTransactionDtoBuilder().build())
      .expect(200)
      .expect(({ body }) => {
        expect(body.feeBreakdown.safenetFeeUsd).toBe(safenetFeeUsd);
        expect(body.feeBreakdown).not.toHaveProperty('safenetFeeSponsored');
        expect(body.feeBreakdown).not.toHaveProperty('someFutureFeeUsd');
      });
  });

  it('should omit the Safenet fee line when the fee service does not report it', async () => {
    const chain = chainBuilder()
      .with('relayer', relayerBuilder().with('type', RelayerType.GTF).build())
      .with('features', ['SAFENET_CHECKS'])
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const mockGtfFeeResponse = gtfFeesResponseBuilder().build();

    mockChain(chain);

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
      .send(feePreviewTransactionDtoBuilder().build())
      .expect(200)
      .expect(({ body }) => {
        expect(body.feeBreakdown).not.toHaveProperty('safenetFeeUsd');
      });
  });

  it.each([
    [
      'forward safenetCheck when the user opts in and the chain has the feature',
      ['SAFENET_CHECKS'],
      { safenetCheck: true },
      { safenetCheck: true },
    ],
    [
      'omit safenetCheck when the user opts in but the chain lacks the feature',
      ['ERC721'],
      { safenetCheck: true },
      {},
    ],
    [
      'omit safenetCheck when the user does not choose on a chain with the feature',
      ['SAFENET_CHECKS'],
      {},
      {},
    ],
    [
      'omit safenetCheck when the user opts out on a chain with the feature',
      ['SAFENET_CHECKS'],
      { safenetCheck: false },
      {},
    ],
  ] as const)('should %s', async (_label, features, choice, expectedFlag) => {
    const chain = chainBuilder()
      .with('relayer', relayerBuilder().with('type', RelayerType.GTF).build())
      .with('features', [...features])
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const feePreviewDto = feePreviewTransactionDtoBuilder().build();
    const gtfUrl = `${feeServiceBaseUri}/v1/chains/${chain.chainId}/safes/${safeAddress}/transactions/gtf/fees`;

    mockChain(chain);

    networkService.post.mockImplementation(({ url }) => {
      if (url === gtfUrl) {
        return Promise.resolve({
          data: rawify(gtfFeesResponseBuilder().build()),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/fees/${safeAddress}/preview`)
      .send({ ...feePreviewDto, ...choice })
      .expect(200);

    expect(networkService.post).toHaveBeenCalledWith(
      expect.objectContaining({
        url: gtfUrl,
        data: {
          to: feePreviewDto.to,
          value: feePreviewDto.value,
          data: feePreviewDto.data,
          operation: feePreviewDto.operation,
          numberSignatures: feePreviewDto.numberSignatures,
          nonce: feePreviewDto.nonce,
          gasToken: feePreviewDto.gasToken,
          origin: feePreviewDto.origin,
          ...expectedFlag,
        },
      }),
    );
  });

  it('should not forward caller context outside the gtf/fees contract', async () => {
    const chain = chainBuilder()
      .with('relayer', relayerBuilder().with('type', RelayerType.GTF).build())
      .with('features', ['SAFENET_CHECKS'])
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const feePreviewDto = feePreviewTransactionDtoBuilder().build();
    const gtfUrl = `${feeServiceBaseUri}/v1/chains/${chain.chainId}/safes/${safeAddress}/transactions/gtf/fees`;

    mockChain(chain);

    networkService.post.mockImplementation(({ url }) => {
      if (url === gtfUrl) {
        return Promise.resolve({
          data: rawify(gtfFeesResponseBuilder().build()),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    // fiatCode belongs to the relay flow; the strict gtf/fees contract
    // excludes it, so it must be dropped while the opt-in is forwarded.
    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/fees/${safeAddress}/preview`)
      .send({ ...feePreviewDto, safenetCheck: true, fiatCode: 'EUR' })
      .expect(200);

    expect(networkService.post).toHaveBeenCalledWith(
      expect.objectContaining({
        url: gtfUrl,
        data: {
          to: feePreviewDto.to,
          value: feePreviewDto.value,
          data: feePreviewDto.data,
          operation: feePreviewDto.operation,
          numberSignatures: feePreviewDto.numberSignatures,
          nonce: feePreviewDto.nonce,
          gasToken: feePreviewDto.gasToken,
          origin: feePreviewDto.origin,
          safenetCheck: true,
        },
      }),
    );
  });

  it('should ignore a caller-sent safenetCheck on a chain without the feature', async () => {
    const chain = chainBuilder()
      .with('relayer', relayerBuilder().with('type', RelayerType.GTF).build())
      .with('features', ['ERC721'])
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const feePreviewDto = feePreviewTransactionDtoBuilder().build();
    const gtfUrl = `${feeServiceBaseUri}/v1/chains/${chain.chainId}/safes/${safeAddress}/transactions/gtf/fees`;

    mockChain(chain);

    networkService.post.mockImplementation(({ url }) => {
      if (url === gtfUrl) {
        return Promise.resolve({
          data: rawify(gtfFeesResponseBuilder().build()),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    // Fail closed: the chain does not offer Safenet checks, so the user's
    // opt-in is not forwarded.
    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/fees/${safeAddress}/preview`)
      .send({ ...feePreviewDto, safenetCheck: true })
      .expect(200);

    expect(networkService.post).toHaveBeenCalledWith(
      expect.objectContaining({
        url: gtfUrl,
        data: {
          to: feePreviewDto.to,
          value: feePreviewDto.value,
          data: feePreviewDto.data,
          operation: feePreviewDto.operation,
          numberSignatures: feePreviewDto.numberSignatures,
          nonce: feePreviewDto.nonce,
          gasToken: feePreviewDto.gasToken,
          origin: feePreviewDto.origin,
        },
      }),
    );
  });

  it('should throw a validation error for a non-boolean safenetCheck', async () => {
    const chain = chainBuilder()
      .with('relayer', relayerBuilder().with('type', RelayerType.GTF).build())
      .with('features', ['SAFENET_CHECKS'])
      .build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    mockChain(chain);

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/fees/${safeAddress}/preview`)
      .send({
        ...feePreviewTransactionDtoBuilder().build(),
        safenetCheck: 'yes',
      })
      .expect(422)
      .expect(({ body }) => {
        expect(body.code).toBe('invalid_type');
        expect(body.path).toEqual(['safenetCheck']);
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
