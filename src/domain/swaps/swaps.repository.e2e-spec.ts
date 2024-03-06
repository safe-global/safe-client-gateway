import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import '@/__tests__/matchers/to-be-string-or-null';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { SwapsModule } from '@/domain/swaps/swaps.module';
import { ValidationModule } from '@/validation/validation.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { ConfigurationModule } from '@/config/configuration.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { SwapsRepository } from '@/domain/swaps/swaps.repository';
import { Order } from '@/domain/swaps/entities/order.entity';
import configuration from '@/config/entities/configuration';

const orderIds = {
  '1': {
    '0x7a30e1c2f1ff69858276f5053516a8f9b879aceeec60bc534c4f8f476aaa6a960b83f617ad1b093e071248930366ca447aa8197165e0a61c':
      {
        appData:
          '0xf249b3db926aa5b5a1b18f3fec86b9cc99b9a8a99ad7e8034242d2838ae97422',
        availableBalance: null,
        buyAmount: '440975954216726478',
        buyToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        buyTokenBalance: 'erc20',
        class: 'limit',
        creationDate: new Date('2024-02-29T15:13:35.865Z'),
        executedBuyAmount: '442341269964797099',
        executedFeeAmount: '0',
        executedSellAmount: '20000000000000000000000',
        executedSellAmountBeforeFees: '20000000000000000000000',
        executedSurplusFee: '344394908543621220441',
        feeAmount: '0',
        fullAppData:
          '{"version":"0.4.0","appCode":"DefiLlama","environment":"production","metadata":{"referrer":{"version":"0.1.0","address":"0x08a3c2A819E3de7ACa384c798269B3Ce1CD0e437"}}}',
        fullFeeAmount: '0',
        invalidated: false,
        isLiquidityOrder: false,
        kind: 'sell',
        owner: '0x0b83f617ad1b093e071248930366ca447aa81971',
        partiallyFillable: false,
        receiver: '0x0b83f617ad1b093e071248930366ca447aa81971',
        sellAmount: '20000000000000000000000',
        sellToken: '0x710287d1d39dcf62094a83ebb3e736e79400068a',
        sellTokenBalance: 'erc20',
        signature:
          '0xfc44c000c53b6e67b6556c206d24b89983c81c626093405a901eadc4df15e9d7320a61d9e007fe006af32428d3099e0073b186a9d3f1fe72e4394842122467d01b',
        signingScheme: 'eip712',
        status: 'fulfilled',
        uid: '0x7a30e1c2f1ff69858276f5053516a8f9b879aceeec60bc534c4f8f476aaa6a960b83f617ad1b093e071248930366ca447aa8197165e0a61c',
        validTo: 1709221404,
      },
  },
  '100': {
    '0x44b2e4fe433e5870a443bea665bafbc72ca4b3b29cb35e4431d0cf68758f827740a50cf069e992aa4536211b23f286ef88752187ffffffff':
      {
        appData:
          '0x15f7794a143d0e5d3217190e3baeac63e6f76c816b10b9a6b89fcb915164d281',
        availableBalance: null,
        buyAmount: '54373933015739874963',
        buyToken: '0xcb444e90d8198415266c6a2724b7900fb12fc56e',
        buyTokenBalance: 'erc20',
        class: 'limit',
        creationDate: new Date('2024-02-29T23:26:25.000Z'),
        ethflowData: {
          refundTxHash: null,
          userValidTo: 1709250961,
        },
        executedBuyAmount: '55483508732021114905',
        executedFeeAmount: '0',
        executedSellAmount: '60000000000000000000',
        executedSellAmountBeforeFees: '60000000000000000000',
        executedSurplusFee: '746134584595989',
        feeAmount: '0',
        fullAppData:
          '{"appCode":"CoW Swap","environment":"production","metadata":{"orderClass":{"orderClass":"market"},"quote":{"slippageBips":"200"}},"version":"0.11.0"}',
        fullFeeAmount: '0',
        invalidated: false,
        isLiquidityOrder: false,
        kind: 'sell',
        onchainOrderData: {
          placementError: null,
          sender: '0x6f1f64b5b2fd66d9c2d2fb9fc55c9422a7e96bf2',
        },
        onchainUser: '0x6f1f64b5b2fd66d9c2d2fb9fc55c9422a7e96bf2',
        owner: '0x40a50cf069e992aa4536211b23f286ef88752187',
        partiallyFillable: false,
        receiver: '0x6f1f64b5b2fd66d9c2d2fb9fc55c9422a7e96bf2',
        sellAmount: '60000000000000000000',
        sellToken: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
        sellTokenBalance: 'erc20',
        signature: '0x40a50cf069e992aa4536211b23f286ef88752187',
        signingScheme: 'eip1271',
        status: 'fulfilled',
        uid: '0x44b2e4fe433e5870a443bea665bafbc72ca4b3b29cb35e4431d0cf68758f827740a50cf069e992aa4536211b23f286ef88752187ffffffff',
        validTo: 4294967295,
      },
  },
};
describe('CowSwap E2E tests', () => {
  let app: INestApplication;
  let repository: SwapsRepository;

  beforeAll(async () => {
    const cacheKeyPrefix = crypto.randomUUID();
    const moduleRef = await Test.createTestingModule({
      imports: [
        // Feature
        SwapsModule,
        // Common
        ConfigurationModule.register(configuration),
        NetworkModule,
        TestLoggingModule,
        ValidationModule,
      ],
    })
      .overrideProvider(CacheKeyPrefix)
      .useValue(cacheKeyPrefix)
      .compile();

    app = moduleRef.createNestApplication();
    repository = app.get(SwapsRepository);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  Object.entries(orderIds).forEach(([chainId, transactions]) => {
    describe(`Chain ID ${chainId}`, () => {
      Object.entries(transactions).forEach(([orderId, expectedObject]) => {
        it(`Transaction ID: ${orderId}`, async () => {
          const actual: Order = await repository.getOrder(
            chainId,
            orderId as `0x${string}`,
          );

          expect(actual).toEqual(expectedObject);
        });
      });
    });
  });
});
