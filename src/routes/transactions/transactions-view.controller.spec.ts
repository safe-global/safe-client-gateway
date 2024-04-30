import { INestApplication } from '@nestjs/common';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import * as request from 'supertest';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { setPreSignatureEncoder } from '@/domain/swaps/contracts/__tests__/encoders/set-pre-signature-encoder.builder';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { faker } from '@faker-js/faker';

describe('TransactionsViewController tests', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let swapsApiUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  const verifiedApp = faker.company.buzzNoun();

  beforeEach(async () => {
    jest.resetAllMocks();

    const baseConfig = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...baseConfig,
      features: {
        ...baseConfig.features,
        confirmationView: true,
      },
      swaps: {
        ...baseConfig.swaps,
        restrictApps: true,
        allowedApps: [verifiedApp],
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
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    swapsApiUrl = configurationService.get('swaps.api.1');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Gets Generic confirmation view', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
        return Promise.resolve({ data: dataDecoded, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
      )
      .send({
        data: '0x',
      })
      .expect(200)
      .expect({
        type: 'GENERIC',
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
  });

  it('Gets swap confirmation view with swap data', async () => {
    const chain = chainBuilder().with('chainId', '1').build();
    const safe = safeBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();
    const preSignatureEncoder = setPreSignatureEncoder();
    const preSignature = preSignatureEncoder.build();
    const order = orderBuilder()
      .with('uid', preSignature.orderUid)
      .with('fullAppData', `{ "appCode": "${verifiedApp}" }`)
      .build();
    const buyToken = tokenBuilder().with('address', order.buyToken).build();
    const sellToken = tokenBuilder().with('address', order.sellToken).build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
        return Promise.resolve({ data: order, status: 200 });
      }
      if (
        url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
      ) {
        return Promise.resolve({ data: buyToken, status: 200 });
      }
      if (
        url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
      ) {
        return Promise.resolve({ data: sellToken, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
        return Promise.resolve({
          data: dataDecoded,
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
      )
      .send({
        data: preSignatureEncoder.encode(),
      })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          type: 'COW_SWAP_ORDER',
          method: dataDecoded.method,
          parameters: dataDecoded.parameters,
          uid: order.uid,
          status: order.status,
          kind: order.kind,
          orderClass: order.class,
          validUntil: order.validTo,
          sellAmount: order.sellAmount.toString(),
          buyAmount: order.buyAmount.toString(),
          executedSellAmount: order.executedSellAmount.toString(),
          executedBuyAmount: order.executedBuyAmount.toString(),
          explorerUrl: expect.any(String),
          executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
          sellToken: {
            address: sellToken.address,
            decimals: sellToken.decimals,
            logoUri: sellToken.logoUri,
            name: sellToken.name,
            symbol: sellToken.symbol,
            trusted: sellToken.trusted,
          },
          buyToken: {
            address: buyToken.address,
            decimals: buyToken.decimals,
            logoUri: buyToken.logoUri,
            name: buyToken.name,
            symbol: buyToken.symbol,
            trusted: buyToken.trusted,
          },
          receiver: order.receiver,
          owner: order.owner,
          fullAppData: JSON.parse(order.fullAppData),
        }),
      );
  });

  it('Gets Generic confirmation view if order data is not available', async () => {
    const chain = chainBuilder().with('chainId', '1').build();
    const safe = safeBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();
    const preSignatureEncoder = setPreSignatureEncoder();
    const preSignature = preSignatureEncoder.build();
    const order = orderBuilder()
      .with('uid', preSignature.orderUid)
      .with('fullAppData', `{ "appCode": "${verifiedApp}" }`)
      .build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
        return Promise.reject({ status: 500 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
        return Promise.resolve({
          data: dataDecoded,
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
      )
      .send({
        data: preSignatureEncoder.encode(),
      })
      .expect(200)
      .expect({
        type: 'GENERIC',
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
  });

  it('Gets Generic confirmation view if buy token data is not available', async () => {
    const chain = chainBuilder().with('chainId', '1').build();
    const safe = safeBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();
    const preSignatureEncoder = setPreSignatureEncoder();
    const preSignature = preSignatureEncoder.build();
    const order = orderBuilder()
      .with('uid', preSignature.orderUid)
      .with('fullAppData', `{ "appCode": "${verifiedApp}" }`)
      .build();
    const sellToken = tokenBuilder().with('address', order.sellToken).build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
        return Promise.resolve({ data: order, status: 200 });
      }
      if (
        url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
      ) {
        return Promise.reject({ status: 500 });
      }
      if (
        url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
      ) {
        return Promise.resolve({ data: sellToken, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
        return Promise.resolve({
          data: dataDecoded,
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
      )
      .send({
        data: preSignatureEncoder.encode(),
      })
      .expect(200)
      .expect({
        type: 'GENERIC',
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
  });

  it('Gets Generic confirmation view if sell token data is not available', async () => {
    const chain = chainBuilder().with('chainId', '1').build();
    const safe = safeBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();
    const preSignatureEncoder = setPreSignatureEncoder();
    const preSignature = preSignatureEncoder.build();
    const order = orderBuilder()
      .with('uid', preSignature.orderUid)
      .with('fullAppData', `{ "appCode": "${verifiedApp}" }`)
      .build();
    const buyToken = tokenBuilder().with('address', order.sellToken).build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
        return Promise.resolve({ data: order, status: 200 });
      }
      if (
        url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
      ) {
        return Promise.resolve({ data: buyToken, status: 200 });
      }
      if (
        url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
      ) {
        return Promise.reject({ status: 500 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
        return Promise.resolve({
          data: dataDecoded,
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
      )
      .send({
        data: preSignatureEncoder.encode(),
      })
      .expect(200)
      .expect({
        type: 'GENERIC',
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
  });

  it('Gets Generic confirmation view if swap app is restricted', async () => {
    const chain = chainBuilder().with('chainId', '1').build();
    const safe = safeBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();
    const preSignatureEncoder = setPreSignatureEncoder();
    const preSignature = preSignatureEncoder.build();
    const order = orderBuilder()
      .with('uid', preSignature.orderUid)
      .with('fullAppData', `{ "appCode": "${faker.company.buzzNoun()}" }`)
      .build();
    const buyToken = tokenBuilder().with('address', order.buyToken).build();
    const sellToken = tokenBuilder().with('address', order.sellToken).build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
        return Promise.resolve({ data: order, status: 200 });
      }
      if (
        url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
      ) {
        return Promise.resolve({ data: buyToken, status: 200 });
      }
      if (
        url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
      ) {
        return Promise.resolve({ data: sellToken, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
        return Promise.resolve({
          data: dataDecoded,
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
      )
      .send({
        data: preSignatureEncoder.encode(),
      })
      .expect(200)
      .expect({
        type: 'GENERIC',
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
  });

  it('executedSurplusFee is rendered as null if not available', async () => {
    const chain = chainBuilder().with('chainId', '1').build();
    const safe = safeBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();
    const preSignatureEncoder = setPreSignatureEncoder();
    const preSignature = preSignatureEncoder.build();
    const order = orderBuilder()
      .with('uid', preSignature.orderUid)
      .with('executedSurplusFee', null)
      .with('fullAppData', `{ "appCode": "${verifiedApp}" }`)
      .build();
    const buyToken = tokenBuilder().with('address', order.buyToken).build();
    const sellToken = tokenBuilder().with('address', order.sellToken).build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
        return Promise.resolve({ data: order, status: 200 });
      }
      if (
        url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
      ) {
        return Promise.resolve({ data: buyToken, status: 200 });
      }
      if (
        url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
      ) {
        return Promise.resolve({ data: sellToken, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
        return Promise.resolve({
          data: dataDecoded,
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
      )
      .send({
        data: preSignatureEncoder.encode(),
      })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          type: 'COW_SWAP_ORDER',
          executedSurplusFee: null,
        }),
      );
  });
});
