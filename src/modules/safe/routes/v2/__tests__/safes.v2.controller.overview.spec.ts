import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { faker } from '@faker-js/faker';
import { balanceBuilder } from '@/modules/balances/domain/entities/__tests__/balance.builder';
import { balanceTokenBuilder } from '@/modules/balances/domain/entities/__tests__/balance.token.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';

describe('Safes V2 Controller Overview (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let pricesProviderUrl: string;
  let zerionBaseUri: string;

  const zerionChainId = '137'; // Polygon - enabled for Zerion
  const nonZerionChainId = '10'; // Optimism - not enabled for Zerion

  beforeEach(async () => {
    jest.clearAllMocks();

    const testConfiguration: typeof configuration = () => ({
      ...configuration(),
      mappings: {
        ...configuration().mappings,
        safe: {
          maxOverviews: 3,
        },
      },
      features: {
        ...configuration().features,
        counterfactualBalances: true,
        zerionBalancesChainIds: [zerionChainId],
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
    });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    pricesProviderUrl = configurationService.getOrThrow(
      'balances.providers.safe.prices.baseUri',
    );
    zerionBaseUri = configurationService.getOrThrow(
      'balances.providers.zerion.baseUri',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v2/safes', () => {
    it('should use balances repository for non-Zerion chains (fallback to v1 logic)', async () => {
      const chain = chainBuilder()
        .with('chainId', nonZerionChainId)
        .with('isTestnet', false)
        .build();
      const safeInfo = safeBuilder().build();
      const tokenAddress = faker.finance.ethereumAddress();
      const secondTokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [chain.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress]: { [currency.toLowerCase()]: 10 },
      };
      const confirmation = confirmationBuilder().build();
      const multisigTransactions = [
        multisigTransactionToJson(
          multisigTransactionBuilder()
            .with('confirmationsRequired', 0)
            .with('confirmations', [confirmation])
            .build(),
        ),
        multisigTransactionToJson(multisigTransactionBuilder().build()),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: rawify(safeInfo), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v2/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}&wallet_address=${confirmation.owner}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              address: {
                value: safeInfo.address,
                name: null,
                logoUri: null,
              },
              chainId: chain.chainId,
              threshold: safeInfo.threshold,
              owners: safeInfo.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: 2,
              awaitingConfirmation: 1,
            },
          ]),
        );

      // Verify balances API was called (not Zerion)
      const balancesCalls = networkService.get.mock.calls.filter(
        (call) =>
          call[0].url ===
          `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`,
      );
      expect(balancesCalls.length).toBeGreaterThan(0);
    });

    it('should use Zerion wallet portfolio API for Zerion-enabled chains', async () => {
      const chain = chainBuilder()
        .with('chainId', zerionChainId)
        .with('isTestnet', false)
        .build();
      const safeInfo = safeBuilder().build();
      const currency = 'USD';

      // Mock Zerion wallet portfolio response
      const zerionPortfolioResponse = {
        data: {
          type: 'portfolio',
          id: safeInfo.address,
          attributes: {
            total: {
              positions: 2500.0,
            },
          },
        },
      };

      const walletAddress = getAddress(faker.finance.ethereumAddress());
      // Create a transaction that needs more confirmations (confirmationsRequired: 2, but only 1 confirmation from different owner)
      const otherOwnerConfirmation = confirmationBuilder().build();
      const multisigTransactions = [
        multisigTransactionToJson(
          multisigTransactionBuilder()
            .with('confirmationsRequired', 2)
            .with('confirmations', [otherOwnerConfirmation])
            .build(),
        ),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: rawify(safeInfo), status: 200 });
          }
          case `${zerionBaseUri}/v1/wallets/${safeInfo.address}/portfolio`: {
            return Promise.resolve({
              data: rawify(zerionPortfolioResponse),
              status: 200,
            });
          }
          case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v2/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}&wallet_address=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              address: {
                value: safeInfo.address,
                name: null,
                logoUri: null,
              },
              chainId: chain.chainId,
              threshold: safeInfo.threshold,
              owners: safeInfo.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '2500',
              queued: 1,
              awaitingConfirmation: 1,
            },
          ]),
        );

      // Verify Zerion portfolio API was called
      const zerionCalls = networkService.get.mock.calls.filter((call) =>
        call[0].url.includes('/portfolio'),
      );
      expect(zerionCalls.length).toBeGreaterThan(0);
    });

    it('returns awaiting confirmation as null if no wallet address is provided', async () => {
      const chain = chainBuilder()
        .with('chainId', nonZerionChainId)
        .with('isTestnet', false)
        .build();
      const safeInfo = safeBuilder().build();
      const tokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [chain.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 12.5 },
      };
      const multisigTransactions = [
        multisigTransactionToJson(multisigTransactionBuilder().build()),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: rawify(safeInfo), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v2/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              address: {
                value: safeInfo.address,
              },
              chainId: chain.chainId,
              awaitingConfirmation: null,
            },
          ]),
        );
    });

    it('should limit the amount of overviewed Safes', async () => {
      const chain = chainBuilder()
        .with('chainId', nonZerionChainId)
        .with('isTestnet', false)
        .build();
      const safeInfo1 = safeBuilder().build();
      const safeInfo2 = safeBuilder().build();
      const safeInfo3 = safeBuilder().build();
      const safeInfo4 = safeBuilder().build(); // This should be excluded

      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '1000000000000000000')
          .with('token', null)
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [chain.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 100,
        },
      };
      const queuedTransactions = pageBuilder()
        .with('results', [])
        .with('count', 0)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url.includes('/api/v1/safes/') && url.includes('/balances/')) {
          return Promise.resolve({
            data: rawify(transactionApiBalancesResponse),
            status: 200,
          });
        }
        if (url.includes('/api/v1/safes/')) {
          // Return matching safe info based on address in URL
          if (url.includes(safeInfo1.address)) {
            return Promise.resolve({ data: rawify(safeInfo1), status: 200 });
          }
          if (url.includes(safeInfo2.address)) {
            return Promise.resolve({ data: rawify(safeInfo2), status: 200 });
          }
          if (url.includes(safeInfo3.address)) {
            return Promise.resolve({ data: rawify(safeInfo3), status: 200 });
          }
          if (url.includes(safeInfo4.address)) {
            return Promise.resolve({ data: rawify(safeInfo4), status: 200 });
          }
        }
        if (url === `${pricesProviderUrl}/simple/price`) {
          return Promise.resolve({
            data: rawify(nativeCoinPriceProviderResponse),
            status: 200,
          });
        }
        if (url.includes('/multisig-transactions/')) {
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(
          `/v2/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo1.address},${chain.chainId}:${safeInfo2.address},${chain.chainId}:${safeInfo3.address},${chain.chainId}:${safeInfo4.address}`,
        )
        .expect(200)
        .expect(({ body }) => {
          // maxOverviews is 3, so safeInfo4 should be excluded
          const overviews = body as Array<{ address: { value: string } }>;
          expect(overviews.length).toBe(3);
          expect(overviews.map((s) => s.address.value)).toEqual([
            safeInfo1.address,
            safeInfo2.address,
            safeInfo3.address,
          ]);
        });
    });
  });
});
