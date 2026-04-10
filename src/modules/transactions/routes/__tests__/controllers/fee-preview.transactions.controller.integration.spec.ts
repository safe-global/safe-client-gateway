// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';

const ENABLED_CHAIN_ID = '1';

describe('Fee Preview - Transactions Controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let feeServiceBaseUri: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      relay: {
        ...baseConfiguration.relay,
        fee: {
          enabledChainIds: [ENABLED_CHAIN_ID],
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
    safeConfigUrl = configService.getOrThrow('safeConfig.baseUri');
    feeServiceBaseUri = configService.getOrThrow('relay.fee.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 if relay-fee is not available for the chain', async () => {
    const chainId = faker.string.numeric({ exclude: [ENABLED_CHAIN_ID] });
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/fees/${safeAddress}/preview`)
      .send({
        to: getAddress(faker.finance.ethereumAddress()),
        value: '0',
        data: '0x',
        operation: Operation.CALL,
        gasToken: '0x0000000000000000000000000000000000000000',
        numberSignatures: 2,
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('Pay with Safe not available for this chain');
      });
  });

  it('should throw a validation error for invalid data', async () => {
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    await request(app.getHttpServer())
      .post(`/v1/chains/${ENABLED_CHAIN_ID}/fees/${safeAddress}/preview`)
      .send({
        to: 'invalid-address',
        value: '0',
        data: '0x',
        operation: Operation.CALL,
        gasToken: '0x0000000000000000000000000000000000000000',
        numberSignatures: 1,
      })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'custom',
        path: ['to'],
        message: 'Invalid address',
      });
  });

  it('should return fee preview when relay-fee is enabled', async () => {
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chainResponse = chainBuilder().build();
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const feePreviewDto = {
      to: getAddress(faker.finance.ethereumAddress()),
      value: '1000000000000000000',
      data: '0x',
      operation: Operation.CALL,
      gasToken: '0x0000000000000000000000000000000000000000',
      numberSignatures: 2,
    };
    const mockFeeResponse = {
      txData: {
        chainId: 1,
        safeAddress,
        safeTxGas: '150000',
        baseGas: '48564',
        gasPrice: '195000000000000',
        gasToken: '0x0000000000000000000000000000000000000000',
        refundReceiver: '0x0000000000000000000000000000000000000000',
        numberSignatures: 2,
      },
      relayCostUsd: 38.22,
      pricingContextSnapshot: {
        phase: 1,
        priceSource: 'COINGECKO',
        priceTimestamp: 1700000000,
        gasVolatilityBuffer: 1.3,
      },
    };

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${ENABLED_CHAIN_ID}`) {
        return Promise.resolve({ data: rawify(chainResponse), status: 200 });
      }
      if (
        url ===
        `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`
      ) {
        return Promise.resolve({ data: rawify(safeResponse), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (
        url ===
        `${feeServiceBaseUri}/v1/chains/${ENABLED_CHAIN_ID}/safes/${safeAddress}/transactions/relay-fees`
      ) {
        return Promise.resolve({ data: rawify(mockFeeResponse), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(`/v1/chains/${ENABLED_CHAIN_ID}/fees/${safeAddress}/preview`)
      .send(feePreviewDto)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject(mockFeeResponse);
      });
  });

  it('should throw a validation error for invalid numberSignatures', async () => {
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    await request(app.getHttpServer())
      .post(`/v1/chains/${ENABLED_CHAIN_ID}/fees/${safeAddress}/preview`)
      .send({
        to: getAddress(faker.finance.ethereumAddress()),
        value: '0',
        data: '0x',
        operation: Operation.CALL,
        gasToken: '0x0000000000000000000000000000000000000000',
        numberSignatures: 0,
      })
      .expect(422)
      .expect(({ body }) => {
        expect(body.code).toBe('too_small');
        expect(body.path).toEqual(['numberSignatures']);
      });
  });
});
