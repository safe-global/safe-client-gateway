// SPDX-License-Identifier: FSL-1.1-MIT
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestIdentityApiModule } from '@/datasources/locking-api/__tests__/test.identity-api.module';
import { IdentityApiModule } from '@/datasources/locking-api/identity-api.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { contractBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  toJson as multisigToJson,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import request from 'supertest';
import { buildSafeWithTransaction } from '@/modules/transactions/routes/__tests__/entities/safe-with-transaction.builder';

describe('Queued transactions across multiple Safes - Transactions Controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let loggingService: jest.MockedObjectDeep<ILoggingService>;

  async function initApp(config: typeof configuration): Promise<void> {
    const moduleFixture = await createTestModule({
      config,
      modules: [
        {
          originalModule: IdentityApiModule,
          testModule: TestIdentityApiModule,
        },
      ],
    });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);
    loggingService = moduleFixture.get(LoggingService);

    jest.spyOn(loggingService, 'error');
    jest.spyOn(loggingService, 'warn');

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();

    const baseConfiguration = configuration();
    const maxOverviews = faker.number.int({ min: 5, max: 20 });
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      mappings: {
        ...baseConfiguration.mappings,
        safe: {
          ...baseConfiguration.mappings.safe,
          maxOverviews,
        },
      },
    });

    await initApp(testConfiguration);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return queued transactions across multiple safes sorted by timestamp', async () => {
    const date1 = faker.date.past();
    const date2 = faker.date.past({ refDate: new Date(date1.getTime() + 1000) });
    const safe1Data = await buildSafeWithTransaction({
      nonce: 1,
      submissionDate: date1,
    });
    const safe2Data = await buildSafeWithTransaction({
      nonce: 1,
      submissionDate: date2,
    });

    // Build a combined mock that handles both chains
    const allMocks = [safe1Data, safe2Data];
    networkService.get.mockImplementation(({ url }) => {
      for (const data of allMocks) {
        const chainUrl = `${safeConfigUrl}/api/v1/chains/${data.chain.chainId}`;
        const safeUrl = `${data.chain.transactionService}/api/v1/safes/${data.safeAddress}`;
        const txUrl = `${data.chain.transactionService}/api/v2/safes/${data.safeAddress}/multisig-transactions/`;

        if (url === chainUrl) {
          return Promise.resolve({
            data: rawify(data.chain),
            status: 200,
          });
        }
        if (url === safeUrl) {
          return Promise.resolve({
            data: rawify(data.safe),
            status: 200,
          });
        }
        if (url === txUrl) {
          return Promise.resolve({
            data: rawify({
              count: 1,
              next: null,
              previous: null,
              results: [
                multisigToJson(data.transaction) as MultisigTransaction,
              ],
            }),
            status: 200,
          });
        }
      }
      if (url.includes('/api/v1/tokens/')) {
        return Promise.resolve({ data: rawify({}), status: 200 });
      }
      if (url.includes('/api/v1/contracts/')) {
        return Promise.resolve({
          data: rawify(
            pageBuilder().with('results', [contractBuilder().build()]).build(),
          ),
          status: 200,
        });
      }
      if (url.includes('/api/v1/safe-apps/')) {
        return Promise.resolve({ data: rawify([]), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    const safesParam = `${safe1Data.chain.chainId}:${safe1Data.safeAddress},${safe2Data.chain.chainId}:${safe2Data.safeAddress}`;

    await request(app.getHttpServer())
      .get(
        `/v1/transactions/queued?safes=${safesParam}&trusted=true&limit=10`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toBeInstanceOf(Array);
        expect(body.length).toBe(2);

        // Both safes present
        const addresses = (body as Array<{ safeAddress: string }>).map(
          (item) => item.safeAddress,
        );
        expect(addresses).toContain(safe1Data.safeAddress);
        expect(addresses).toContain(safe2Data.safeAddress);

        // Each item has transaction data
        for (const item of body as Array<{
          transaction: { id: string; timestamp: number };
          chainId: string;
          safeAddress: string;
        }>) {
          expect(item.transaction).toBeDefined();
          expect(item.transaction.id).toBeDefined();
          expect(item.chainId).toBeDefined();
          expect(item.safeAddress).toBeDefined();
        }

        // Verify timestamp ordering (oldest first)
        expect(
          (body[0] as { transaction: { timestamp: number } }).transaction
            .timestamp,
        ).toBeLessThanOrEqual(
          (body[1] as { transaction: { timestamp: number } }).transaction
            .timestamp,
        );
      });
  });

  it('should respect the limit parameter', async () => {
    const date1 = faker.date.past();
    const date2 = faker.date.past({ refDate: new Date(date1.getTime() + 1000) });
    const safe1Data = await buildSafeWithTransaction({
      nonce: 1,
      submissionDate: date1,
    });
    const safe2Data = await buildSafeWithTransaction({
      nonce: 1,
      submissionDate: date2,
    });

    const allMocks = [safe1Data, safe2Data];
    networkService.get.mockImplementation(({ url }) => {
      for (const data of allMocks) {
        const chainUrl = `${safeConfigUrl}/api/v1/chains/${data.chain.chainId}`;
        const safeUrl = `${data.chain.transactionService}/api/v1/safes/${data.safeAddress}`;
        const txUrl = `${data.chain.transactionService}/api/v2/safes/${data.safeAddress}/multisig-transactions/`;

        if (url === chainUrl) {
          return Promise.resolve({
            data: rawify(data.chain),
            status: 200,
          });
        }
        if (url === safeUrl) {
          return Promise.resolve({
            data: rawify(data.safe),
            status: 200,
          });
        }
        if (url === txUrl) {
          return Promise.resolve({
            data: rawify({
              count: 1,
              next: null,
              previous: null,
              results: [
                multisigToJson(data.transaction) as MultisigTransaction,
              ],
            }),
            status: 200,
          });
        }
      }
      if (url.includes('/api/v1/tokens/')) {
        return Promise.resolve({ data: rawify({}), status: 200 });
      }
      if (url.includes('/api/v1/contracts/')) {
        return Promise.resolve({
          data: rawify(
            pageBuilder().with('results', [contractBuilder().build()]).build(),
          ),
          status: 200,
        });
      }
      if (url.includes('/api/v1/safe-apps/')) {
        return Promise.resolve({ data: rawify([]), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    const safesParam = `${safe1Data.chain.chainId}:${safe1Data.safeAddress},${safe2Data.chain.chainId}:${safe2Data.safeAddress}`;

    await request(app.getHttpServer())
      .get(
        `/v1/transactions/queued?safes=${safesParam}&trusted=true&limit=1`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toBeInstanceOf(Array);
        expect(body.length).toBe(1);
      });
  });

  it('should return empty array when no safes have queued transactions', async () => {
    const chain = chainBuilder().build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safe = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', 1)
      .build();

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === `${chain.transactionService}/api/v1/safes/${safeAddress}`) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (
        url ===
        `${chain.transactionService}/api/v2/safes/${safeAddress}/multisig-transactions/`
      ) {
        return Promise.resolve({
          data: rawify({
            count: 0,
            next: null,
            previous: null,
            results: [],
          }),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    const safesParam = `${chain.chainId}:${safeAddress}`;

    await request(app.getHttpServer())
      .get(
        `/v1/transactions/queued?safes=${safesParam}&trusted=true&limit=10`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toBeInstanceOf(Array);
        expect(body.length).toBe(0);
      });
  });

  it('should return 422 for invalid safes query parameter', async () => {
    await request(app.getHttpServer())
      .get(
        `/v1/transactions/queued?safes=invalid&trusted=true&limit=10`,
      )
      .expect(422);
  });

  it('should use default values for trusted and limit', async () => {
    const chain = chainBuilder().build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safe = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', 1)
      .build();

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === `${chain.transactionService}/api/v1/safes/${safeAddress}`) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (
        url ===
        `${chain.transactionService}/api/v2/safes/${safeAddress}/multisig-transactions/`
      ) {
        return Promise.resolve({
          data: rawify({
            count: 0,
            next: null,
            previous: null,
            results: [],
          }),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    const safesParam = `${chain.chainId}:${safeAddress}`;

    await request(app.getHttpServer())
      .get(`/v1/transactions/queued?safes=${safesParam}`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toBeInstanceOf(Array);
      });
  });
});
