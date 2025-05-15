import { faker } from '@faker-js/faker';

import { LiFiDecoder } from '@/domain/bridge/contracts/decoders/lifi-decoder.helper';

// TODO: Find exampled and/or generate these
const BRIDGE_TRANSACTION = '0x';
const SWAP_TRANSACTION = '0x';
const SWAP_AND_BRIDGE_TRANSACTION = '0x';

describe('LiFiDecoder', () => {
  let target: LiFiDecoder;
  let fromChain: string;

  beforeEach(() => {
    fromChain = faker.string.numeric();
    target = new LiFiDecoder(fromChain);
  });

  describe('isBridge', () => {
    describe('bridge transaction', () => {
      it.todo(
        'should return true for a bridge transaction to a different chain that',
      );

      it.todo('should return false for a bridge transaction to the same chain');
    });

    describe('swap and bridge transaction', () => {
      it.todo(
        'should return true for a swap and bridge transaction to a different chain that does not swap',
      );

      it.todo(
        'should return false for a swap and bridge transaction to a different chain that swaps',
      );

      it.todo(
        'should return false for a swap and bridge transaction to the same chain that does not swap',
      );

      it.todo(
        'should return false for a swap and bridge transaction to the same chain that swaps',
      );
    });

    describe('swap transaction', () => {
      it.todo('should return false for a swap transaction that swaps');

      it.todo('should return false for a swap transaction that does not swap');
    });

    it.todo('should return false for a non-LiFi transaction');
  });

  describe('isSwap', () => {
    describe('bridge transaction', () => {
      it.todo(
        'should return false for a bridge transaction to a different chain that',
      );

      it.todo('should return false for a bridge transaction to the same chain');
    });

    describe('swap and bridge transaction', () => {
      it.todo(
        'should return true for a swap and bridge transaction to the same chain that swaps',
      );

      it.todo(
        'should return false for a swap and bridge transaction to a different chain that does not swap',
      );

      it.todo(
        'should return false for a swap and bridge transaction to a different chain that swaps',
      );

      it.todo(
        'should return false for a swap and bridge transaction to the same chain that does not swap',
      );
    });

    describe('swap transaction', () => {
      it.todo('should return true for a swap transaction that swaps');

      it.todo('should return false for a swap transaction that does not swap');
    });

    it.todo('should return false for a non-LiFi transaction');
  });

  describe('isSwapAndBridge', () => {
    describe('bridge transaction', () => {
      it.todo(
        'should return false for a bridge transaction to a different chain that',
      );

      it.todo('should return false for a bridge transaction to the same chain');
    });

    describe('swap and bridge transaction', () => {
      it.todo(
        'should return true for a swap and bridge transaction to the same chain that swaps',
      );

      it.todo(
        'should return false for a swap and bridge transaction to a different chain that does not swap',
      );

      it.todo(
        'should return false for a swap and bridge transaction to a different chain that swaps',
      );

      it.todo(
        'should return false for a swap and bridge transaction to the same chain that does not swap',
      );
    });

    describe('swap transaction', () => {
      it.todo('should return true for a swap transaction that swaps');

      it.todo('should return false for a swap transaction that does not swap');
    });

    it.todo('should return false for a non-LiFi transaction');
  });

  describe('decodeBridgeAndMaybeSwap', () => {
    it.todo('should decode a bridge transaction');

    it.todo('should decode a swap and bridge transaction');

    it.todo('should throw an error for a swap transaction');

    it.todo('should throw an error for a non-LiFi transaction');
  });

  describe('decodeSwap', () => {
    it.skip.each([
      'swapTokensSingleV3ERC20ToERC20',
      'swapTokensSingleV3ERC20ToNative',
      'swapTokensSingleV3NativeToERC20',
    ])('should decode a %s (single swap) transaction', () => {
      expect(true).toBe(false);
    });

    it.todo('should decode a multi swap transaction');

    it.todo('should throw an error for insufficient data');

    it.todo('should throw an error for a bridge transaction');

    it.todo('should throw an error for a swap and bridge transaction');

    it.todo('should throw an error for a non-LiFi transaction');
  });
});
