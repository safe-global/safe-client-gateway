import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import {
  zerionCollectibleAttributesBuilder,
  zerionCollectibleBuilder,
  zerionCollectiblesBuilder,
  zerionNFTInfoBuilder,
} from '@/datasources/balances-api/entities/__tests__/zerion-collectible.entity.builder';

describe('Zerion Collectibles Controller', () => {
  let app: INestApplication;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let zerionBaseUri: string;
  let zerionChainIds: string[];

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
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
    zerionBaseUri = configurationService.get(
      'balances.providers.zerion.baseUri',
    );
    zerionChainIds = configurationService.get(
      'features.zerionBalancesChainIds',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Collectibles provider: Zerion', () => {
    describe('GET /v2/collectibles', () => {
      it('successfully gets collectibles from Zerion', async () => {
        const chain = chainBuilder().with('chainId', zerionChainIds[0]).build();
        const safeAddress = faker.finance.ethereumAddress();
        const aTokenAddress = faker.finance.ethereumAddress();
        const aNFTName = faker.string.sample();
        const anUrl = faker.internet.url({ appendSlash: true });
        const zerionApiCollectiblesResponse = zerionCollectiblesBuilder()
          .with('data', [
            zerionCollectibleBuilder()
              .with(
                'attributes',
                zerionCollectibleAttributesBuilder()
                  .with(
                    'nft_info',
                    zerionNFTInfoBuilder()
                      .with('contract_address', aTokenAddress)
                      .build(),
                  )
                  .build(),
              )
              .build(),
            zerionCollectibleBuilder()
              .with(
                'attributes',
                zerionCollectibleAttributesBuilder()
                  .with(
                    'nft_info',
                    zerionNFTInfoBuilder().with('name', aNFTName).build(),
                  )
                  .build(),
              )
              .build(),
            zerionCollectibleBuilder()
              .with(
                'attributes',
                zerionCollectibleAttributesBuilder()
                  .with(
                    'nft_info',
                    zerionNFTInfoBuilder()
                      .with('content', {
                        preview: { url: anUrl },
                        detail: { url: anUrl },
                      })
                      .build(),
                  )
                  .build(),
              )
              .build(),
          ])
          .build();
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(
            `balances.providers.zerion.chains.${chain.chainId}.chainName`,
          );
        const apiKey = app
          .get(IConfigurationService)
          .getOrThrow(`balances.providers.zerion.apiKey`);
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`:
              return Promise.resolve({
                data: zerionApiCollectiblesResponse,
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v2/chains/${chain.chainId}/safes/${safeAddress}/collectibles`)
          .expect(200)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              count: zerionApiCollectiblesResponse.data.length,
              next: null,
              previous: null,
              results: [
                {
                  address: aTokenAddress,
                  tokenName:
                    zerionApiCollectiblesResponse.data[0].attributes.nft_info
                      .name,
                  tokenSymbol:
                    zerionApiCollectiblesResponse.data[0].attributes.nft_info
                      .name,
                  logoUri:
                    zerionApiCollectiblesResponse.data[0].attributes
                      .collection_info?.content?.icon.url,
                  id: zerionApiCollectiblesResponse.data[0].attributes.nft_info
                    .token_id,
                  uri: zerionApiCollectiblesResponse.data[0].attributes.nft_info
                    .content?.detail?.url,
                  name: zerionApiCollectiblesResponse.data[0].attributes
                    .collection_info?.name,
                  description:
                    zerionApiCollectiblesResponse.data[0].attributes
                      .collection_info?.description,
                  imageUri:
                    zerionApiCollectiblesResponse.data[0].attributes.nft_info
                      .content?.preview?.url,
                  metadata:
                    zerionApiCollectiblesResponse.data[0].attributes.nft_info
                      .content,
                },
                {
                  address:
                    zerionApiCollectiblesResponse.data[1].attributes.nft_info
                      .contract_address,
                  tokenName: aNFTName,
                  tokenSymbol:
                    zerionApiCollectiblesResponse.data[1].attributes.nft_info
                      .name,
                  logoUri:
                    zerionApiCollectiblesResponse.data[1].attributes
                      .collection_info?.content?.icon.url,
                  id: zerionApiCollectiblesResponse.data[1].attributes.nft_info
                    .token_id,
                  uri: zerionApiCollectiblesResponse.data[1].attributes.nft_info
                    .content?.detail?.url,
                  name: zerionApiCollectiblesResponse.data[1].attributes
                    .collection_info?.name,
                  description:
                    zerionApiCollectiblesResponse.data[1].attributes
                      .collection_info?.description,
                  imageUri:
                    zerionApiCollectiblesResponse.data[1].attributes.nft_info
                      .content?.preview?.url,
                  metadata:
                    zerionApiCollectiblesResponse.data[1].attributes.nft_info
                      .content,
                },
                {
                  address:
                    zerionApiCollectiblesResponse.data[2].attributes.nft_info
                      .contract_address,
                  tokenSymbol:
                    zerionApiCollectiblesResponse.data[2].attributes.nft_info
                      .name,
                  logoUri:
                    zerionApiCollectiblesResponse.data[2].attributes
                      .collection_info?.content?.icon.url,
                  id: zerionApiCollectiblesResponse.data[2].attributes.nft_info
                    .token_id,
                  uri: anUrl,
                  name: zerionApiCollectiblesResponse.data[2].attributes
                    .collection_info?.name,
                  description:
                    zerionApiCollectiblesResponse.data[2].attributes
                      .collection_info?.description,
                  imageUri:
                    zerionApiCollectiblesResponse.data[2].attributes.nft_info
                      .content?.preview?.url,
                  metadata:
                    zerionApiCollectiblesResponse.data[2].attributes.nft_info
                      .content,
                },
              ],
            });
          });

        expect(networkService.get.mock.calls.length).toBe(1);
        expect(networkService.get.mock.calls[0][0]).toBe(
          `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`,
        );
        expect(networkService.get.mock.calls[0][1]).toStrictEqual({
          headers: { Authorization: `Basic ${apiKey}` },
          params: { 'filter[chain_ids]': chainName, sort: '-floor_price' },
        });
      });
    });

    describe('Zerion Balances API Error', () => {
      it(`500 error response`, async () => {
        const chain = chainBuilder().with('chainId', zerionChainIds[0]).build();
        const safeAddress = faker.finance.ethereumAddress();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`:
              return Promise.reject(new Error('test error'));
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v2/chains/${chain.chainId}/safes/${safeAddress}/collectibles`)
          .expect(503)
          .expect({
            message: `Error getting ${safeAddress} collectibles from provider: test error}`,
            code: 503,
          });
      });
    });
  });
});
