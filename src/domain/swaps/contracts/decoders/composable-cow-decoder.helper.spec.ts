import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { ComposableCowDecoder } from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';
import { faker } from '@faker-js/faker';
import { zeroAddress } from 'viem';

const COMPOSABLE_COW_ADDRESS =
  '0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74' as const;

describe('ComposableCowDecoder', () => {
  const multiSendDecoder = new MultiSendDecoder();
  const target = new ComposableCowDecoder(multiSendDecoder);

  describe('createWithContext', () => {
    /**
     * Direct `createWithContext` call on Composable CoW contract
     *
     * @see https://sepolia.etherscan.io/address/0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74
     */
    const createWithContextCalldata =
      '0x0d0d9800000000000000000000000000000000000000000000000000000000000000008000000000000000000000000052ed56da04309aca4c3fecc595298d80c2f16bac000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006cf1e9ca41f7611def408122793c358a3d11e5a500000000000000000000000000000000000000000000000000000019011f294a00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000be72e441bf55620febc26715db68d3494213d8cb000000000000000000000000fff9976782d46cc05630d1f6ebab18b2324d6b1400000000000000000000000031eac7f0141837b266de30f4dc9af15629bd538100000000000000000000000000000000000000000000000b941d039eed310b36000000000000000000000000000000000000000000000000087bbc924df9167e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000007080000000000000000000000000000000000000000000000000000000000000000f7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda00000000000000000000000000000000000000000000000000000000000000000' as const;

    describe('isTwapOrder', () => {
      it('should return true for TWAP orders to ComposableCoW contract', () => {
        const result = target.isTwapOrder({
          address: COMPOSABLE_COW_ADDRESS,
          data: createWithContextCalldata,
        });

        expect(result).toBe(true);
      });

      it('should return false for non-TWAP orders to ComposableCoW contract', () => {
        const data = faker.string.hexadecimal() as `0x${string}`;

        const result = target.isTwapOrder({
          address: COMPOSABLE_COW_ADDRESS,
          data,
        });

        expect(result).toBe(false);
      });

      it('should return false for TWAP orders to non-ComposableCoW contract', () => {
        const result = target.isTwapOrder({
          address: zeroAddress,
          data: createWithContextCalldata,
        });

        expect(result).toBe(false);
      });
    });

    describe('decodeTwapOrder', () => {
      it('should decode a createWithContext call', () => {
        const result = target.decodeTwapOrder(createWithContextCalldata);

        if (!result) {
          throw new Error('Unable to decode createWithContext data');
        }

        expect(result).toStrictEqual({
          appData:
            '0xf7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda0',
          buyAmount: BigInt('1222579021996502268'),
          buyToken: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
          durationOfPart: {
            durationType: 'AUTO',
          },
          numberOfParts: BigInt('2'),
          receiver: '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381',
          sellAmount: BigInt('427173750967724283500'),
          sellToken: '0xbe72E441BF55620febc26715db68d3494213D8Cb',
          startTime: {
            startType: 'AT_MINING_TIME',
          },
          timeBetweenParts: BigInt('1800'),
        });
      });

      it('should return null for non-createWithContext data', () => {
        const data = faker.string.hexadecimal() as `0x${string}`;

        const result = target.decodeTwapOrder(data);

        expect(result).toBe(null);
      });

      it.todo('should throw if TWAP handler is invalid');
    });
  });

  describe('createWithContext in multiSend', () => {
    /**
     * MultiSend that enables the extensible Fallback Handler then calls `createWithContext` on Composable CoW contract
     * Note: the last (third) transaction in the batch is the `createWithContext` call
     *
     * @see https://sepolia.etherscan.io/tx/0x50c8ce57a75591105fd782a1047a0c6078dfa28e279d12397c79b097eff5650f
     */
    const multiSendCreateWithContextCalldata =
      '0x0d0d9800000000000000000000000000000000000000000000000000000000000000008000000000000000000000000052ed56da04309aca4c3fecc595298d80c2f16bac000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006cf1e9ca41f7611def408122793c358a3d11e5a500000000000000000000000000000000000000000000000000000019011918e600000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000fff9976782d46cc05630d1f6ebab18b2324d6b14000000000000000000000000be72e441bf55620febc26715db68d3494213d8cb00000000000000000000000031eac7f0141837b266de30f4dc9af15629bd538100000000000000000000000000000000000000000000000003782dace9d90000000000000000000000000000000000000000000000000003b1b5fbf83bf2f7160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000003840000000000000000000000000000000000000000000000000000000000000000f7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda00000000000000000000000000000000000000000000000000000000000000000' as const;

    describe('isTwapOrder', () => {
      it('should return true for TWAP orders to ComposableCoW contract', () => {
        const result = target.isTwapOrder({
          address: COMPOSABLE_COW_ADDRESS,
          data: multiSendCreateWithContextCalldata,
        });

        expect(result).toBe(true);
      });

      it('should return false for non-TWAP orders to ComposableCoW contract', () => {
        const data = faker.string.hexadecimal() as `0x${string}`;

        const result = target.isTwapOrder({
          address: COMPOSABLE_COW_ADDRESS,
          data,
        });

        expect(result).toBe(false);
      });

      it('should return false for TWAP orders to non-ComposableCoW contract', () => {
        const result = target.isTwapOrder({
          address: zeroAddress,
          data: multiSendCreateWithContextCalldata,
        });

        expect(result).toBe(false);
      });
    });

    describe('decodeTwapOrder', () => {
      it('should decode a createWithContext call', () => {
        const result = target.decodeTwapOrder(
          multiSendCreateWithContextCalldata,
        );

        if (!result) {
          throw new Error('Unable to decode createWithContext data');
        }

        expect(result).toStrictEqual({
          appData:
            '0xf7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda0',
          buyAmount: BigInt('272582601520811072600'),
          buyToken: '0xbe72E441BF55620febc26715db68d3494213D8Cb',
          durationOfPart: {
            durationType: 'AUTO',
          },
          numberOfParts: BigInt('4'),
          receiver: '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381',
          sellAmount: BigInt('1000000000000000000'),
          sellToken: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
          startTime: {
            startType: 'AT_MINING_TIME',
          },
          timeBetweenParts: BigInt('900'),
        });
      });

      it('should return null for non-createWithContext data', () => {
        const data = faker.string.hexadecimal() as `0x${string}`;

        const result = target.decodeTwapOrder(data);

        expect(result).toBe(null);
      });

      it.todo('should throw if TWAP handler is invalid');
    });
  });
});
