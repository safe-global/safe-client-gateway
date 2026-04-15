// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';
import { feePreviewTransactionDtoBuilder } from '@/modules/fees/routes/entities/__tests__/fee-preview-transaction.dto.builder';
import { txFeesResponseBuilder } from '@/modules/transactions/domain/entities/relay-fee/__tests__/tx-fees-response.builder';

const ENABLED_CHAIN_ID = '1';

describe('Fees Controller', () => {
  let app: INestApplication<Server>;
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
      .send(feePreviewTransactionDtoBuilder().build())
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('Pay with Safe not available for this chain');
      });
  });

  it('should throw a validation error for invalid data', async () => {
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    await request(app.getHttpServer())
      .post(`/v1/chains/${ENABLED_CHAIN_ID}/fees/${safeAddress}/preview`)
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

  it('should return fee preview when relay-fee is enabled', async () => {
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const feePreviewDto = feePreviewTransactionDtoBuilder()
      .with('value', '1000000000000000000')
      .build();
    const mockFeeResponse = txFeesResponseBuilder().build();

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
