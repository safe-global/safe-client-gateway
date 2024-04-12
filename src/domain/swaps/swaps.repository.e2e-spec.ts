import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import '@/__tests__/matchers/to-be-string-or-null';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { SwapsModule } from '@/domain/swaps/swaps.module';
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
        buyAmount: BigInt('440975954216726478'),
        buyToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        buyTokenBalance: 'erc20',
        class: 'limit',
        creationDate: new Date('2024-02-29T15:13:35.865Z'),
        ethflowData: null,
        executedBuyAmount: BigInt('442341269964797099'),
        executedFeeAmount: BigInt('0'),
        executedSellAmount: BigInt('20000000000000000000000'),
        executedSellAmountBeforeFees: BigInt('20000000000000000000000'),
        executedSurplusFee: BigInt('344394908543621220441'),
        feeAmount: BigInt('0'),
        from: null,
        fullAppData:
          '{"version":"0.4.0","appCode":"DefiLlama","environment":"production","metadata":{"referrer":{"version":"0.1.0","address":"0x08a3c2A819E3de7ACa384c798269B3Ce1CD0e437"}}}',
        fullFeeAmount: BigInt('0'),
        invalidated: false,
        isLiquidityOrder: false,
        kind: 'sell',
        owner: '0x0B83F617ad1B093E071248930366Ca447aa81971',
        onchainOrderData: null,
        onchainUser: null,
        partiallyFillable: false,
        receiver: '0x0B83F617ad1B093E071248930366Ca447aa81971',
        quoteId: null,
        sellAmount: BigInt('20000000000000000000000'),
        sellToken: '0x710287D1D39DCf62094A83EBB3e736e79400068a',
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
        buyAmount: BigInt('54373933015739874963'),
        buyToken: '0xcB444e90D8198415266c6a2724b7900fb12FC56E',
        buyTokenBalance: 'erc20',
        class: 'limit',
        creationDate: new Date('2024-02-29T23:26:25.000Z'),
        ethflowData: {
          refundTxHash: null,
          userValidTo: 1709250961,
        },
        executedBuyAmount: BigInt('55483508732021114905'),
        executedFeeAmount: BigInt('0'),
        executedSellAmount: BigInt('60000000000000000000'),
        executedSellAmountBeforeFees: BigInt('60000000000000000000'),
        executedSurplusFee: BigInt('746134584595989'),
        feeAmount: BigInt('0'),
        from: null,
        fullAppData:
          '{"appCode":"CoW Swap","environment":"production","metadata":{"orderClass":{"orderClass":"market"},"quote":{"slippageBips":"200"}},"version":"0.11.0"}',
        fullFeeAmount: BigInt('0'),
        invalidated: false,
        isLiquidityOrder: false,
        kind: 'sell',
        onchainOrderData: {
          placementError: null,
          sender: '0x6f1F64B5B2fd66D9C2D2FB9fC55c9422A7e96bf2',
        },
        onchainUser: '0x6f1F64B5B2fd66D9C2D2FB9fC55c9422A7e96bf2',
        owner: '0x40A50cf069e992AA4536211B23F286eF88752187',
        quoteId: null,
        partiallyFillable: false,
        receiver: '0x6f1F64B5B2fd66D9C2D2FB9fC55c9422A7e96bf2',
        sellAmount: BigInt('60000000000000000000'),
        sellToken: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
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
