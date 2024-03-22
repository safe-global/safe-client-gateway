import { INestApplication } from '@nestjs/common';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { Test, TestingModule } from '@nestjs/testing';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import * as request from 'supertest';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { faker } from '@faker-js/faker';
import { balanceBuilder } from '@/domain/balances/entities/__tests__/balance.builder';
import { balanceTokenBuilder } from '@/domain/balances/entities/__tests__/balance.token.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { getAddress } from 'viem';

describe('Safes Controller Overview (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let pricesProviderUrl: string;
  let pricesApiKey: string;

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
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    pricesProviderUrl = configurationService.getOrThrow(
      'balances.providers.safe.prices.baseUri',
    );
    pricesApiKey = configurationService.getOrThrow(
      'balances.providers.safe.prices.apiKey',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /safes', () => {
    it('overview with transactions awaiting confirmation is correctly serialised', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
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
      const nativeCoinId = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain.chainId}.nativeCoin`,
        );
      const chainName = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain.chainId}.chainName`,
        );
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId]: { [currency.toLowerCase()]: 1536.75 },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress]: { [currency.toLowerCase()]: 10 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const multisigTransactions = [
        multisigTransactionToJson(
          multisigTransactionBuilder()
            .with('confirmations', [
              // Signature provided
              confirmationBuilder().with('owner', walletAddress).build(),
            ])
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
            return Promise.resolve({ data: chain, status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: safeInfo, status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: nativeCoinPriceProviderResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chainName}`: {
            return Promise.resolve({
              data: tokenPriceProviderResponse,
              status: 200,
            });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: queuedTransactions,
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
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}&walletAddress=${walletAddress}`,
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

      expect(networkService.get.mock.calls.length).toBe(7);

      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[2][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[3][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`,
      );
      expect(networkService.get.mock.calls[3][0].networkRequest).toStrictEqual({
        params: { trusted: false, exclude_spam: true },
      });
      expect(networkService.get.mock.calls[4][0].url).toBe(
        `${pricesProviderUrl}/simple/token_price/${chainName}`,
      );
      expect(networkService.get.mock.calls[4][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          vs_currencies: currency.toLowerCase(),
          contract_addresses: [
            tokenAddress.toLowerCase(),
            secondTokenAddress.toLowerCase(),
          ].join(','),
        },
      });
      expect(networkService.get.mock.calls[5][0].url).toBe(
        `${pricesProviderUrl}/simple/price`,
      );
      expect(networkService.get.mock.calls[5][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: { ids: nativeCoinId, vs_currencies: currency.toLowerCase() },
      });
      expect(networkService.get.mock.calls[6][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`,
      );
    });

    it('overview of multiple Safes across different chains is correctly serialised', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chain2 = chainBuilder().with('chainId', '10').build();
      const safeInfo1 = safeBuilder().build();
      const safeInfo2 = safeBuilder().build();
      const safeInfo3 = safeBuilder().build();

      const tokenAddress1 = faker.finance.ethereumAddress();
      const tokenAddress2 = faker.finance.ethereumAddress();
      const secondTokenAddress1 = faker.finance.ethereumAddress();
      const secondTokenAddress2 = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse1 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse2 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress2))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse3 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress2))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const nativeCoinId1 = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain1.chainId}.nativeCoin`,
        );
      const nativeCoinId2 = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain2.chainId}.nativeCoin`,
        );
      const chainName1 = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain1.chainId}.chainName`,
        );
      const chainName2 = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain2.chainId}.chainName`,
        );
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId1]: { [currency.toLowerCase()]: 1536.75 },
        [nativeCoinId2]: { [currency.toLowerCase()]: 1536.75 },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress1]: { [currency.toLowerCase()]: 10 },
        [secondTokenAddress2]: { [currency.toLowerCase()]: 10 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const queuedTransactions1 = pageBuilder().build();
      const queuedTransactions2 = pageBuilder().build();
      const queuedTransactions3 = pageBuilder().build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain1.chainId}`: {
            return Promise.resolve({ data: chain1, status: 200 });
          }
          case `${safeConfigUrl}/api/v1/chains/${chain2.chainId}`: {
            return Promise.resolve({ data: chain2, status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}`: {
            return Promise.resolve({ data: safeInfo1, status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}`: {
            return Promise.resolve({ data: safeInfo2, status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}`: {
            return Promise.resolve({ data: safeInfo3, status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse1,
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse2,
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse3,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: nativeCoinPriceProviderResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chainName1}`: {
            return Promise.resolve({
              data: tokenPriceProviderResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chainName2}`: {
            return Promise.resolve({
              data: tokenPriceProviderResponse,
              status: 200,
            });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: queuedTransactions1,
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: queuedTransactions2,
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: queuedTransactions3,
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
          `/v1/safes?currency=${currency}&safes=${chain1.chainId}:${safeInfo1.address},${chain2.chainId}:${safeInfo2.address},${chain2.chainId}:${safeInfo3.address}&walletAddress=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              address: {
                value: safeInfo1.address,
                name: null,
                logoUri: null,
              },
              chainId: chain1.chainId,
              threshold: safeInfo1.threshold,
              owners: safeInfo1.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions1.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo2.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo2.threshold,
              owners: safeInfo2.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '4910.25',
              queued: queuedTransactions2.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo3.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo3.threshold,
              owners: safeInfo3.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions3.count,
              awaitingConfirmation: expect.any(Number),
            },
          ]),
        );
    });

    it('should limit the amount of overviewed Safes', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chain2 = chainBuilder().with('chainId', '10').build();
      const safeInfo1 = safeBuilder().build();
      const safeInfo2 = safeBuilder().build();
      const safeInfo3 = safeBuilder().build();
      // Extra Safe
      const safeInfo4 = safeBuilder().build();

      const tokenAddress1 = faker.finance.ethereumAddress();
      const tokenAddress2 = faker.finance.ethereumAddress();
      const secondTokenAddress1 = faker.finance.ethereumAddress();
      const secondTokenAddress2 = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse1 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse2 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress2))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse3 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress2))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const nativeCoinId1 = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain1.chainId}.nativeCoin`,
        );
      const nativeCoinId2 = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain2.chainId}.nativeCoin`,
        );
      const chainName1 = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain1.chainId}.chainName`,
        );
      const chainName2 = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain2.chainId}.chainName`,
        );
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId1]: { [currency.toLowerCase()]: 1536.75 },
        [nativeCoinId2]: { [currency.toLowerCase()]: 1536.75 },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress1]: { [currency.toLowerCase()]: 10 },
        [secondTokenAddress2]: { [currency.toLowerCase()]: 10 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const queuedTransactions1 = pageBuilder().build();
      const queuedTransactions2 = pageBuilder().build();
      const queuedTransactions3 = pageBuilder().build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain1.chainId}`: {
            return Promise.resolve({ data: chain1, status: 200 });
          }
          case `${safeConfigUrl}/api/v1/chains/${chain2.chainId}`: {
            return Promise.resolve({ data: chain2, status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}`: {
            return Promise.resolve({ data: safeInfo1, status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}`: {
            return Promise.resolve({ data: safeInfo2, status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}`: {
            return Promise.resolve({ data: safeInfo3, status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse1,
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse2,
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse3,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: nativeCoinPriceProviderResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chainName1}`: {
            return Promise.resolve({
              data: tokenPriceProviderResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chainName2}`: {
            return Promise.resolve({
              data: tokenPriceProviderResponse,
              status: 200,
            });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: queuedTransactions1,
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: queuedTransactions2,
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: queuedTransactions3,
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
          `/v1/safes?currency=${currency}&safes=${chain1.chainId}:${safeInfo1.address},${chain2.chainId}:${safeInfo2.address},${chain2.chainId}:${safeInfo3.address},${chain2.chainId}:${safeInfo4.address}&walletAddress=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              address: {
                value: safeInfo1.address,
                name: null,
                logoUri: null,
              },
              chainId: chain1.chainId,
              threshold: safeInfo1.threshold,
              owners: safeInfo1.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions1.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo2.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo2.threshold,
              owners: safeInfo2.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '4910.25',
              queued: queuedTransactions2.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo3.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo3.threshold,
              owners: safeInfo3.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions3.count,
              awaitingConfirmation: expect.any(Number),
            },
          ]),
        );
    });

    it('returns awaiting confirmation as null if no wallet address is', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
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
      const nativeCoinId = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain.chainId}.nativeCoin`,
        );
      const chainName = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain.chainId}.chainName`,
        );
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId]: { [currency.toLowerCase()]: 1536.75 },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress]: { [currency.toLowerCase()]: 10 },
      };
      const multisigTransactions = [
        multisigTransactionToJson(multisigTransactionBuilder().build()),
        multisigTransactionToJson(multisigTransactionBuilder().build()),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: chain, status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: safeInfo, status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: nativeCoinPriceProviderResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chainName}`: {
            return Promise.resolve({
              data: tokenPriceProviderResponse,
              status: 200,
            });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: queuedTransactions,
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
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}`,
        )
        .expect(200)
        .expect([
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
            // No wallet address specified
            awaitingConfirmation: null,
          },
        ]);

      expect(networkService.get.mock.calls.length).toBe(7);

      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[2][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[3][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`,
      );
      expect(networkService.get.mock.calls[3][0].networkRequest).toStrictEqual({
        params: { trusted: false, exclude_spam: true },
      });
      expect(networkService.get.mock.calls[4][0].url).toBe(
        `${pricesProviderUrl}/simple/token_price/${chainName}`,
      );
      expect(networkService.get.mock.calls[4][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          vs_currencies: currency.toLowerCase(),
          contract_addresses: [
            tokenAddress.toLowerCase(),
            secondTokenAddress.toLowerCase(),
          ].join(','),
        },
      });
      expect(networkService.get.mock.calls[5][0].url).toBe(
        `${pricesProviderUrl}/simple/price`,
      );
      expect(networkService.get.mock.calls[5][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: { ids: nativeCoinId, vs_currencies: currency.toLowerCase() },
      });
      expect(networkService.get.mock.calls[6][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`,
      );
    });

    it('forwards trusted and exlude spam queries', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
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
      const nativeCoinId = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain.chainId}.nativeCoin`,
        );
      const chainName = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain.chainId}.chainName`,
        );
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId]: { [currency.toLowerCase()]: 1536.75 },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress]: { [currency.toLowerCase()]: 10 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const multisigTransactions = [
        multisigTransactionToJson(multisigTransactionBuilder().build()),
        multisigTransactionToJson(multisigTransactionBuilder().build()),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: chain, status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: safeInfo, status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: nativeCoinPriceProviderResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chainName}`: {
            return Promise.resolve({
              data: tokenPriceProviderResponse,
              status: 200,
            });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: queuedTransactions,
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
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}&walletAddress=${walletAddress}&trusted=${true}&exclude_spam=${false}`,
        )
        .expect(200)
        .expect([
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
            awaitingConfirmation: 2,
          },
        ]);

      expect(networkService.get.mock.calls.length).toBe(7);

      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[2][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[3][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`,
      );
      expect(networkService.get.mock.calls[3][0].networkRequest).toStrictEqual({
        // Forwarded params
        params: { trusted: true, exclude_spam: false },
      });
      expect(networkService.get.mock.calls[4][0].url).toBe(
        `${pricesProviderUrl}/simple/token_price/${chainName}`,
      );
      expect(networkService.get.mock.calls[4][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          vs_currencies: currency.toLowerCase(),
          contract_addresses: [
            tokenAddress.toLowerCase(),
            secondTokenAddress.toLowerCase(),
          ].join(','),
        },
      });
      expect(networkService.get.mock.calls[5][0].url).toBe(
        `${pricesProviderUrl}/simple/price`,
      );
      expect(networkService.get.mock.calls[5][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: { ids: nativeCoinId, vs_currencies: currency.toLowerCase() },
      });
      expect(networkService.get.mock.calls[6][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`,
      );
    });
  });

  describe('Validation', () => {
    it('forwards error responses from the Config Service', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeInfo = safeBuilder().build();
      const currency = faker.finance.currencyCode();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            const error = new NetworkResponseError(
              new URL(`${safeConfigUrl}/api/v1/chains/${chain.chainId}`),
              {
                status: 404,
              } as Response,
            );
            return Promise.reject(error);
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}`,
        )
        .expect(404);
    });

    it('forwards error responses from the Transaction Service', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeInfo = safeBuilder().build();
      const currency = faker.finance.currencyCode();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: chain, status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            const error = new NetworkResponseError(
              new URL(
                `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
              ),
              {
                status: 500,
              } as Response,
            );
            return Promise.reject(error);
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}`,
        )
        .expect(500);
    });

    it('throw a 500 if validation of the Transaction Service return Promise.rejects', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
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

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: chain, status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: 'invalid', status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
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
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}`,
        )
        .expect(500)
        .expect({ statusCode: 500, message: 'Internal server error' });
    });

    it('should return a 0-balance when an error is thrown by the provider', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeInfo = safeBuilder().build();
      const tokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress))
          .with('balance', '40000000000000000000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const nativeCoinId = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain.chainId}.nativeCoin`,
        );
      const chainName = app
        .get(IConfigurationService)
        .getOrThrow(
          `balances.providers.safe.prices.chains.${chain.chainId}.chainName`,
        );
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId]: { [currency.toLowerCase()]: 1536.75 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const multisigTransactions = [
        multisigTransactionToJson(multisigTransactionBuilder().build()),
        multisigTransactionToJson(multisigTransactionBuilder().build()),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: chain, status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: safeInfo, status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: transactionApiBalancesResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: nativeCoinPriceProviderResponse,
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chainName}`: {
            return Promise.reject();
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: queuedTransactions,
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
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}&walletAddress=${walletAddress}`,
        )
        .expect(200)
        .expect([
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
            fiatTotal: '0',
            queued: 2,
            awaitingConfirmation: 2,
          },
        ]);
    });
  });
});
