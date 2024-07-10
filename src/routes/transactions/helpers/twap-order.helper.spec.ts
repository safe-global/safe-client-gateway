import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import {
  staticInputEncoder,
  conditionalOrderParamsBuilder,
  createWithContextEncoder,
} from '@/domain/swaps/contracts/__tests__/encoders/composable-cow-encoder.builder';
import { ComposableCowDecoder } from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';
import { TransactionDataFinder } from '@/routes/transactions/helpers/transaction-data-finder.helper';
import { TwapOrderHelper } from '@/routes/transactions/helpers/twap-order.helper';
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
describe('TwapOrderHelper', () => {
  const ComposableCowAddress = '0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74';

  /**
   * @see https://sepolia.etherscan.io/address/0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74
   */
  const directCalldata =
    '0x0d0d9800000000000000000000000000000000000000000000000000000000000000008000000000000000000000000052ed56da04309aca4c3fecc595298d80c2f16bac000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006cf1e9ca41f7611def408122793c358a3d11e5a500000000000000000000000000000000000000000000000000000019011f294a00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000be72e441bf55620febc26715db68d3494213d8cb000000000000000000000000fff9976782d46cc05630d1f6ebab18b2324d6b1400000000000000000000000031eac7f0141837b266de30f4dc9af15629bd538100000000000000000000000000000000000000000000000b941d039eed310b36000000000000000000000000000000000000000000000000087bbc924df9167e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000007080000000000000000000000000000000000000000000000000000000000000000f7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda00000000000000000000000000000000000000000000000000000000000000000';
  /**
   * `createWithContext` call is third transaction in batch
   * @see https://sepolia.etherscan.io/address/0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B
   */
  const batchedCalldata =
    '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000003cb0031eac7f0141837b266de30f4dc9af15629bd538100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024f08a03230000000000000000000000002f55e8b20d0b9fefa187aa7d00b6cbe563605bf50031eac7f0141837b266de30f4dc9af15629bd5381000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000443365582cdaee378bd0eb30ddf479272accf91761e697bc00e067a268f95f1d2732ed230b000000000000000000000000fdafc9d1902f4e0b84f65f49f244b32b31013b7400fdafc9d1902f4e0b84f65f49f244b32b31013b74000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002640d0d9800000000000000000000000000000000000000000000000000000000000000008000000000000000000000000052ed56da04309aca4c3fecc595298d80c2f16bac000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006cf1e9ca41f7611def408122793c358a3d11e5a500000000000000000000000000000000000000000000000000000019011918e600000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000fff9976782d46cc05630d1f6ebab18b2324d6b14000000000000000000000000be72e441bf55620febc26715db68d3494213d8cb00000000000000000000000031eac7f0141837b266de30f4dc9af15629bd538100000000000000000000000000000000000000000000000003782dace9d90000000000000000000000000000000000000000000000000003b1b5fbf83bf2f7160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000003840000000000000000000000000000000000000000000000000000000000000000f7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

  const multiSendDecoder = new MultiSendDecoder();
  const transactionDataFinder = new TransactionDataFinder(multiSendDecoder);
  const composableCowDecoder = new ComposableCowDecoder();
  const configurationService = new FakeConfigurationService();
  configurationService.set('swaps.restrictApps', false);
  const target = new TwapOrderHelper(
    transactionDataFinder,
    composableCowDecoder,
  );

  describe('findTwapOrder', () => {
    describe('direct createWithContext call', () => {
      it('should find order to the official ComposableCoW contract', () => {
        const result = target.findTwapOrder({
          to: ComposableCowAddress,
          data: directCalldata,
        });

        expect(result).toStrictEqual(directCalldata);
      });

      it('should not find order to an unofficial ComposableCoW contract', () => {
        const result = target.findTwapOrder({
          to: zeroAddress,
          data: directCalldata,
        });

        expect(result).toBe(null);
      });
    });

    describe('batched createWithContext call', () => {
      it('should find order to the official ComposableCoW contract', () => {
        const result = target.findTwapOrder({
          to: ComposableCowAddress,
          data: batchedCalldata,
        });

        expect(result).toStrictEqual(
          // Thirs transaction in batch
          '0x0d0d9800000000000000000000000000000000000000000000000000000000000000008000000000000000000000000052ed56da04309aca4c3fecc595298d80c2f16bac000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006cf1e9ca41f7611def408122793c358a3d11e5a500000000000000000000000000000000000000000000000000000019011918e600000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000fff9976782d46cc05630d1f6ebab18b2324d6b14000000000000000000000000be72e441bf55620febc26715db68d3494213d8cb00000000000000000000000031eac7f0141837b266de30f4dc9af15629bd538100000000000000000000000000000000000000000000000003782dace9d90000000000000000000000000000000000000000000000000003b1b5fbf83bf2f7160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000003840000000000000000000000000000000000000000000000000000000000000000f7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda00000000000000000000000000000000000000000000000000000000000000000',
        );
      });

      it('should not find order to an unofficial ComposableCoW contract', () => {
        const staticInput = staticInputEncoder();
        const conditionalOrderParams = conditionalOrderParamsBuilder()
          .with('staticInput', staticInput.encode())
          // TWAP handler address
          .with('handler', '0x6cF1e9cA41f7611dEf408122793c358a3d11E5a5')
          .build();
        const createWithContext = createWithContextEncoder().with(
          'params',
          conditionalOrderParams,
        );
        const transactions = multiSendTransactionsEncoder([
          {
            operation: 0,
            data: createWithContext.encode(),
            // Not official ComposableCoW address
            to: getAddress(faker.finance.ethereumAddress()),
            value: BigInt(0),
          },
        ]);
        const data = multiSendEncoder()
          .with('transactions', transactions)
          .encode();

        const result = target.findTwapOrder({
          to: zeroAddress, // MultiSend decoder does not check officiality of address
          data,
        });

        expect(result).toBe(null);
      });
    });

    describe('generateTwapOrderParts', () => {
      it('should generate TWAP order parts', () => {
        const twapStruct =
          composableCowDecoder.decodeTwapStruct(directCalldata);
        const executionDate = faker.date.past();
        const chainId = faker.string.numeric();

        const result = target.generateTwapOrderParts({
          twapStruct,
          executionDate,
          chainId,
        });

        expect(result).toStrictEqual([
          {
            appData:
              '0xf7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda0',
            buyAmount: BigInt('611289510998251134'),
            buyToken: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
            buyTokenBalance: 'erc20',
            feeAmount: BigInt('0'),
            kind: 'sell',
            partiallyFillable: false,
            receiver: '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381',
            sellAmount: BigInt('213586875483862141750'),
            sellToken: '0xbe72E441BF55620febc26715db68d3494213D8Cb',
            sellTokenBalance: 'erc20',
            validTo:
              Math.ceil(executionDate.getTime() / 1_000) +
              // First part of the order
              (1 * Number(twapStruct.t) - 1),
          },
          {
            appData:
              '0xf7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda0',
            buyAmount: BigInt('611289510998251134'),
            buyToken: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
            buyTokenBalance: 'erc20',
            feeAmount: BigInt('0'),
            kind: 'sell',
            partiallyFillable: false,
            receiver: '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381',
            sellAmount: BigInt('213586875483862141750'),
            sellToken: '0xbe72E441BF55620febc26715db68d3494213D8Cb',
            sellTokenBalance: 'erc20',
            validTo:
              Math.ceil(executionDate.getTime() / 1_000) +
              // Second part of the order
              (2 * Number(twapStruct.t) - 1),
          },
        ]);
      });
    });
  });
});
