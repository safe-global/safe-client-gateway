import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NULL_ADDRESS } from '../common/constants';
import { faker } from '@faker-js/faker';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '../../config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { AppModule, configurationModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  positionAttributesBuilder,
  positionBuilder,
  positionFungibleInfoBuilder,
  positionFungibleInfoImplementationBuilder,
  positionQuantityBuilder,
} from '@/domain/portfolios/entities/__tests__/position.builder';
import {
  portfolioAttributesBuilder,
  portfolioBuilder,
} from '@/domain/portfolios/entities/__tests__/portfolio.builder';

describe('Balances Controller (Unit)', () => {
  let app: INestApplication;
  let portfoliosProviderUrl;
  let networkService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(configurationModule)
      .useModule(ConfigurationModule.register(configuration))
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    portfoliosProviderUrl = configurationService.get(
      'portfoliosProvider.baseUri',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /balances', () => {
    it(`maps native coin + ERC20 token balance correctly`, async () => {
      const chain = chainBuilder().with('chainId', '1').build();
      const safeAddress = faker.finance.ethereumAddress();
      const currency = 'eur';
      const implementationAddress = faker.finance.ethereumAddress();
      const testTokenIconUrl = faker.internet.url();
      const etherIconUrl = faker.internet.url();
      const positions = [
        positionBuilder()
          .with(
            'attributes',
            positionAttributesBuilder()
              .with(
                'quantity',
                positionQuantityBuilder()
                  .with('int', '12000000000000000')
                  .with('decimals', 15)
                  .build(),
              )
              .with('value', 27)
              .with('price', 1.5)
              .with(
                'fungible_info',
                positionFungibleInfoBuilder()
                  .with('name', 'Test Token')
                  .with('symbol', 'TST')
                  .with('icon', { url: testTokenIconUrl })
                  .with('implementations', [
                    positionFungibleInfoImplementationBuilder()
                      .with('address', implementationAddress)
                      .with('chain_id', 'ethereum')
                      .build(),
                    positionFungibleInfoImplementationBuilder()
                      .with('address', faker.finance.ethereumAddress())
                      .with('chain_id', 'avalanche')
                      .build(),
                  ])
                  .build(),
              )
              .build(),
          )
          .build(),
        positionBuilder()
          .with(
            'attributes',
            positionAttributesBuilder()
              .with(
                'quantity',
                positionQuantityBuilder()
                  .with('int', '25000000000000000')
                  .with('decimals', 18)
                  .build(),
              )
              .with('value', 38.085)
              .with('price', 1523.4)
              .with(
                'fungible_info',
                positionFungibleInfoBuilder()
                  .with('name', 'Ethereum')
                  .with('symbol', 'ETH')
                  .with('icon', { url: etherIconUrl })
                  .with('implementations', [
                    positionFungibleInfoImplementationBuilder()
                      .with('address', null)
                      .with('chain_id', 'ethereum')
                      .build(),
                    positionFungibleInfoImplementationBuilder()
                      .with('address', faker.finance.ethereumAddress())
                      .with('chain_id', 'avalanche')
                      .build(),
                    positionFungibleInfoImplementationBuilder()
                      .with('address', faker.finance.ethereumAddress())
                      .with('chain_id', 'xdai')
                      .build(),
                  ])
                  .build(),
              )
              .build(),
          )
          .build(),
      ];
      const portfolio = portfolioBuilder()
        .with(
          'attributes',
          portfolioAttributesBuilder()
            .with('total', { positions: 1550.4 })
            .build(),
        )
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`:
            return Promise.resolve({ data: positions });
          case `${portfoliosProviderUrl}/wallets/${safeAddress}/portfolio/?currency=${currency}`:
            return Promise.resolve({ data: portfolio });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
        )
        .expect(200)
        .expect({
          fiatTotal: '1550.4',
          items: [
            {
              tokenInfo: {
                type: 'NATIVE_TOKEN',
                address: NULL_ADDRESS,
                decimals: 18,
                symbol: 'ETH',
                name: 'Ethereum',
                logoUri: etherIconUrl,
              },
              balance: '25000000000000000',
              fiatBalance: '38.085',
              fiatConversion: '1523.4',
            },
            {
              tokenInfo: {
                type: 'ERC20',
                address: implementationAddress,
                decimals: 15,
                symbol: 'TST',
                name: 'Test Token',
                logoUri: testTokenIconUrl,
              },
              balance: '12000000000000000',
              fiatBalance: '27',
              fiatConversion: '1.5',
            },
          ],
        });

      expect(networkService.get.mock.calls.length).toBe(2);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`,
      );
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${portfoliosProviderUrl}/wallets/${safeAddress}/portfolio/?currency=${currency}`,
      );
    });

    it(`returns large numbers as is (not in scientific notation)`, async () => {
      const chain = chainBuilder().with('chainId', '1').build();
      const safeAddress = faker.finance.ethereumAddress();
      const currency = 'eur';
      const implementationAddress = faker.finance.ethereumAddress();
      const testTokenIconUrl = faker.internet.url();
      const etherIconUrl = faker.internet.url();
      const positions = [
        positionBuilder()
          .with(
            'attributes',
            positionAttributesBuilder()
              .with(
                'quantity',
                positionQuantityBuilder()
                  .with('int', '12000000000000000000000000000')
                  .with('decimals', 15)
                  .build(),
              )
              .with('value', 27000000000000000000)
              .with('price', 15000000000000000000)
              .with(
                'fungible_info',
                positionFungibleInfoBuilder()
                  .with('name', 'Test Token')
                  .with('symbol', 'TST')
                  .with('icon', { url: testTokenIconUrl })
                  .with('implementations', [
                    positionFungibleInfoImplementationBuilder()
                      .with('address', implementationAddress)
                      .with('chain_id', 'ethereum')
                      .build(),
                    positionFungibleInfoImplementationBuilder()
                      .with('address', faker.finance.ethereumAddress())
                      .with('chain_id', 'avalanche')
                      .build(),
                  ])
                  .build(),
              )
              .build(),
          )
          .build(),
        positionBuilder()
          .with(
            'attributes',
            positionAttributesBuilder()
              .with(
                'quantity',
                positionQuantityBuilder()
                  .with('int', '25000000000000000000000000000')
                  .with('decimals', 18)
                  .build(),
              )
              .with('value', 38000000000000000000)
              .with('price', 15234000000000000000000)
              .with(
                'fungible_info',
                positionFungibleInfoBuilder()
                  .with('name', 'Ethereum')
                  .with('symbol', 'ETH')
                  .with('icon', { url: etherIconUrl })
                  .with('implementations', [
                    positionFungibleInfoImplementationBuilder()
                      .with('address', null)
                      .with('chain_id', 'ethereum')
                      .build(),
                    positionFungibleInfoImplementationBuilder()
                      .with('address', faker.finance.ethereumAddress())
                      .with('chain_id', 'avalanche')
                      .build(),
                    positionFungibleInfoImplementationBuilder()
                      .with('address', faker.finance.ethereumAddress())
                      .with('chain_id', 'xdai')
                      .build(),
                  ])
                  .build(),
              )
              .build(),
          )
          .build(),
      ];
      const portfolio = portfolioBuilder()
        .with(
          'attributes',
          portfolioAttributesBuilder()
            .with('total', { positions: 1550415234000000000000000000 })
            .build(),
        )
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`:
            return Promise.resolve({ data: positions });
          case `${portfoliosProviderUrl}/wallets/${safeAddress}/portfolio/?currency=${currency}`:
            return Promise.resolve({ data: portfolio });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
        )
        .expect(200)
        .expect({
          fiatTotal: '1550415234000000000000000000',
          items: [
            {
              tokenInfo: {
                type: 'NATIVE_TOKEN',
                address: NULL_ADDRESS,
                decimals: 18,
                symbol: 'ETH',
                name: 'Ethereum',
                logoUri: etherIconUrl,
              },
              balance: '25000000000000000000000000000',
              fiatBalance: '38000000000000000000',
              fiatConversion: '15234000000000000000000',
            },
            {
              tokenInfo: {
                type: 'ERC20',
                address: implementationAddress,
                decimals: 15,
                symbol: 'TST',
                name: 'Test Token',
                logoUri: testTokenIconUrl,
              },
              balance: '12000000000000000000000000000',
              fiatBalance: '27000000000000000000',
              fiatConversion: '15000000000000000000',
            },
          ],
        });

      expect(networkService.get.mock.calls.length).toBe(2);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`,
      );
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${portfoliosProviderUrl}/wallets/${safeAddress}/portfolio/?currency=${currency}`,
      );
    });

    describe('Prices provider API Error', () => {
      it(`500 error response while retrieving positions`, async () => {
        const chain = chainBuilder().with('chainId', '1').build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = 'eur';
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`:
              return Promise.reject({ status: 500 });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(503)
          .expect({
            message: `Error getting ${safeAddress} positions from provider: 500`,
            code: 503,
          });

        expect(networkService.get.mock.calls.length).toBe(1);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`,
        );
      });

      it(`429 error response while retrieving positions`, async () => {
        const chain = chainBuilder().with('chainId', '1').build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = 'eur';
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`:
              return Promise.reject({ status: 429 });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(503)
          .expect({
            message: `Error getting ${safeAddress} positions from provider: 429`,
            code: 503,
          });

        expect(networkService.get.mock.calls.length).toBe(1);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`,
        );
      });

      it(`500 error response while retrieving portfolio`, async () => {
        const chain = chainBuilder().with('chainId', '1').build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = 'eur';
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`:
              return Promise.resolve({
                data: [
                  positionBuilder().build(),
                  positionBuilder().build(),
                  positionBuilder().build(),
                ],
              });
            case `${portfoliosProviderUrl}/wallets/${safeAddress}/portfolio/?currency=${currency}`:
              return Promise.reject({ status: 500 });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(503)
          .expect({
            message: `Error getting ${safeAddress} portfolio from provider: 500`,
            code: 503,
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`,
        );
        expect(networkService.get.mock.calls[1][0]).toBe(
          `${portfoliosProviderUrl}/wallets/${safeAddress}/portfolio/?currency=${currency}`,
        );
      });

      it(`Invalid positions returned`, async () => {
        const chain = chainBuilder().with('chainId', '1').build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = 'eur';
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`:
              return Promise.resolve({ data: 'notAnArray' });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(503)
          .expect({
            message: 'Invalid positions coming from Portfolios API',
            code: 503,
          });

        expect(networkService.get.mock.calls.length).toBe(1);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`,
        );
      });

      it(`Invalid portfolio returned`, async () => {
        const chain = chainBuilder().with('chainId', '1').build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = 'eur';
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`:
              return Promise.resolve({
                data: [
                  positionBuilder().build(),
                  positionBuilder().build(),
                  positionBuilder().build(),
                ],
              });
            case `${portfoliosProviderUrl}/wallets/${safeAddress}/portfolio/?currency=${currency}`:
              return Promise.resolve({ data: null });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(503)
          .expect({
            message: 'Invalid portfolio coming from Portfolios API',
            code: 503,
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${portfoliosProviderUrl}/wallets/${safeAddress}/positions?chain_id=ethereum&sort=value&currency=${currency}`,
        );
        expect(networkService.get.mock.calls[1][0]).toBe(
          `${portfoliosProviderUrl}/wallets/${safeAddress}/portfolio/?currency=${currency}`,
        );
      });
    });
  });

  describe.skip('GET /balances/supported-fiat-codes', () => {
    it('Success', async () => {
      const fiatCodes = {};
      networkService.get.mockResolvedValueOnce({ data: fiatCodes });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(200)
        .expect(['USD', 'EUR', 'AED', 'AFN', 'ALL']);
    });

    it('Failure getting fiat currencies data', async () => {
      networkService.get.mockRejectedValueOnce(new Error());

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(503)
        .expect({
          code: 503,
          message: 'Error getting Fiat Codes from exchange',
        });
    });
  });
});
