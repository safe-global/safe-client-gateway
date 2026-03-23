import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestIdentityApiModule } from '@/datasources/locking-api/__tests__/test.identity-api.module';
import { IdentityApiModule } from '@/datasources/locking-api/identity-api.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { contractBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  toJson as multisigToJson,
  multisigTransactionBuilder,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
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
import { getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

describe('Multi-Safe queued transactions - Transactions Controller', () => {
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
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      mappings: {
        ...baseConfiguration.mappings,
        safe: {
          ...baseConfiguration.mappings.safe,
          maxOverviews: 10,
        },
      },
    });

    await initApp(testConfiguration);
  });

  afterEach(async () => {
    await app.close();
  });

  async function buildSafeWithTransaction(args: {
    nonce: number;
    submissionDate: Date;
  }): Promise<{
    chain: ReturnType<typeof chainBuilder>['build'] extends () => infer R
      ? R
      : never;
    safeAddress: string;
    safe: ReturnType<typeof safeBuilder>['build'] extends () => infer R
      ? R
      : never;
    transaction: MultisigTransaction;
  }> {
    const chain = chainBuilder().build();
    const signers = Array.from({ length: 2 }, () =>
      privateKeyToAccount(generatePrivateKey()),
    );
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safe = safeBuilder()
      .with('address', safeAddress)
      .with('nonce', args.nonce)
      .with(
        'owners',
        signers.map((s) => s.address),
      )
      .build();
    const tx = await multisigTransactionBuilder()
      .with('safe', safeAddress)
      .with('isExecuted', false)
      .with('nonce', args.nonce)
      .with('submissionDate', args.submissionDate)
      .with('modified', args.submissionDate)
      .buildWithConfirmations({
        safe,
        chainId: chain.chainId,
        signers: [signers[0]],
      });
    return { chain, safeAddress, safe, transaction: tx };
  }

  it('should return queued transactions across multiple safes sorted by timestamp', async () => {
    const safe1Data = await buildSafeWithTransaction({
      nonce: 1,
      submissionDate: new Date('2024-01-01T00:00:00Z'),
    });
    const safe2Data = await buildSafeWithTransaction({
      nonce: 1,
      submissionDate: new Date('2024-06-01T00:00:00Z'),
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
        `/v1/multi-safe/transactions/queued?safes=${safesParam}&trusted=true&limit=10`,
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
    const safe1Data = await buildSafeWithTransaction({
      nonce: 1,
      submissionDate: new Date('2024-01-01T00:00:00Z'),
    });
    const safe2Data = await buildSafeWithTransaction({
      nonce: 1,
      submissionDate: new Date('2024-06-01T00:00:00Z'),
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
        `/v1/multi-safe/transactions/queued?safes=${safesParam}&trusted=true&limit=1`,
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
        `/v1/multi-safe/transactions/queued?safes=${safesParam}&trusted=true&limit=10`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toBeInstanceOf(Array);
        expect(body.length).toBe(0);
      });
  });

  it('should gracefully handle a failing safe and return results for successful ones', async () => {
    const failingChain = chainBuilder().build();
    const failingAddress = getAddress(faker.finance.ethereumAddress());

    const successData = await buildSafeWithTransaction({
      nonce: 1,
      submissionDate: new Date('2024-01-01T00:00:00Z'),
    });

    networkService.get.mockImplementation(({ url }) => {
      // Failing safe
      if (url === `${safeConfigUrl}/api/v1/chains/${failingChain.chainId}`) {
        return Promise.resolve({
          data: rawify(failingChain),
          status: 200,
        });
      }
      if (
        url ===
        `${failingChain.transactionService}/api/v1/safes/${failingAddress}`
      ) {
        return Promise.reject(new Error('Safe not found'));
      }
      // Successful safe
      const chainUrl = `${safeConfigUrl}/api/v1/chains/${successData.chain.chainId}`;
      const safeUrl = `${successData.chain.transactionService}/api/v1/safes/${successData.safeAddress}`;
      const txUrl = `${successData.chain.transactionService}/api/v2/safes/${successData.safeAddress}/multisig-transactions/`;

      if (url === chainUrl) {
        return Promise.resolve({
          data: rawify(successData.chain),
          status: 200,
        });
      }
      if (url === safeUrl) {
        return Promise.resolve({
          data: rawify(successData.safe),
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
              multisigToJson(successData.transaction) as MultisigTransaction,
            ],
          }),
          status: 200,
        });
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

    const safesParam = `${failingChain.chainId}:${failingAddress},${successData.chain.chainId}:${successData.safeAddress}`;

    await request(app.getHttpServer())
      .get(
        `/v1/multi-safe/transactions/queued?safes=${safesParam}&trusted=true&limit=10`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toBeInstanceOf(Array);
        expect(body.length).toBe(1);
        expect(body[0].safeAddress).toBe(successData.safeAddress);
        expect(body[0].chainId).toBe(successData.chain.chainId);
      });

    expect(loggingService.warn).toHaveBeenCalledWith(
      expect.stringContaining('Error fetching multi-safe queue'),
    );
  });

  it('should return 422 for invalid safes query parameter', async () => {
    await request(app.getHttpServer())
      .get(
        `/v1/multi-safe/transactions/queued?safes=invalid&trusted=true&limit=10`,
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
      .get(`/v1/multi-safe/transactions/queued?safes=${safesParam}`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toBeInstanceOf(Array);
      });
  });
});
