import { faker } from '@faker-js/faker';
import { decodeFunctionData, getAddress } from 'viem';
import type { Hex } from 'viem';

import { LiFiDecoder } from '@/modules/bridge/domain/contracts/decoders/lifi-decoder.helper';
import {
  bridgeDataStructBuilder,
  startBridgeTokensViaAcrossV3Encoder,
  swapAndStartBridgeTokensViaAcrossV3Encoder,
  swapDataStructBuilder,
  swapTokensMultiV3ERC20ToERC20Encoder,
  swapTokensSingleV3ERC20ToERC20Encoder,
} from '@/modules/bridge/domain/contracts/decoders/__tests__/across-v3-encoder.builder';

// Note: whilst the LiFi Diamond contract has multiple facets, the function signatures have
// common parameters. This means that we can safely rely on AcrossV3 for these tests.
describe('LiFiDecoder', () => {
  let target: LiFiDecoder;

  beforeEach(() => {
    target = new LiFiDecoder();
  });

  describe('isBridge', () => {
    describe('bridge transaction', () => {
      it('should return true when bridging to a different chain', () => {
        const fromChain = faker.string.numeric();
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with(
                'destinationChainId',
                BigInt(faker.string.numeric({ exclude: fromChain })),
              )
              .with('hasSourceSwaps', false)
              .build(),
          )
          .encode();

        const result = target.isBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(true);
      });

      it('should return false when bridging to the same chain', () => {
        const fromChain = faker.string.numeric();
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with('destinationChainId', BigInt(fromChain))
              .with('hasSourceSwaps', false)
              .build(),
          )
          .encode();

        const result = target.isBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    describe('swap and bridge transaction', () => {
      it('should return false when swapping to a different chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with(
                'destinationChainId',
                BigInt(faker.string.numeric({ exclude: fromChain })),
              )
              .with('hasSourceSwaps', true)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return false when swapping on the same chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with('destinationChainId', BigInt(fromChain))
              .with('hasSourceSwaps', true)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return true when only bridging to a different chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with(
                'destinationChainId',
                BigInt(faker.string.numeric({ exclude: fromChain })),
              )
              .with('hasSourceSwaps', false)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(true);
      });

      it('should return false when only bridging to the same chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with('destinationChainId', BigInt(fromChain))
              .with('hasSourceSwaps', false)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    describe('single swap transaction', () => {
      it('should return false when swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with(
            'swapData',
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          )
          .encode();

        const result = target.isBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return false when not swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with(
            'swapData',
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          )
          .encode();

        const result = target.isBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    describe('multi swap transaction', () => {
      it('should return false when swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return false when not swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    it('should return false for a non-LiFi transaction', () => {
      const fromChain = faker.string.numeric();
      const data = faker.string.hexadecimal() as Hex;

      const result = target.isBridge({
        data,
        chainId: fromChain,
      });

      expect(result).toBe(false);
    });
  });

  describe('isSwap', () => {
    describe('bridge transaction', () => {
      it('should return false when bridging to a different chain', () => {
        const fromChain = faker.string.numeric();
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with(
                'destinationChainId',
                BigInt(faker.string.numeric({ exclude: fromChain })),
              )
              .with('hasSourceSwaps', false)
              .build(),
          )
          .encode();

        const result = target.isSwap({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return false when bridging to the same chain', () => {
        const fromChain = faker.string.numeric();
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with('destinationChainId', BigInt(fromChain))
              .with('hasSourceSwaps', false)
              .build(),
          )
          .encode();

        const result = target.isSwap({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    describe('swap and bridge transaction', () => {
      it('should return false when swapping to a different chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with(
                'destinationChainId',
                BigInt(faker.string.numeric({ exclude: fromChain })),
              )
              .with('hasSourceSwaps', true)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwap({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return true when swapping on the same chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with('destinationChainId', BigInt(fromChain))
              .with('hasSourceSwaps', true)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwap({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(true);
      });

      it('should return false when only bridging to a different chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with(
                'destinationChainId',
                BigInt(faker.string.numeric({ exclude: fromChain })),
              )
              .with('hasSourceSwaps', false)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwap({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return false when only bridging to the same chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with('destinationChainId', BigInt(fromChain))
              .with('hasSourceSwaps', false)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwap({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    describe('single swap transaction', () => {
      it('should return true when swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with(
            'swapData',
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          )
          .encode();

        const result = target.isSwap({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(true);
      });

      it('should return false when not swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with(
            'swapData',
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          )
          .encode();

        const result = target.isSwap({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    describe('multi swap transaction', () => {
      it('should return true when swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwap({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(true);
      });

      it('should return false when not swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwap({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    it('should return false for a non-LiFi transaction', () => {
      const fromChain = faker.string.numeric();
      const data = faker.string.hexadecimal() as Hex;

      const result = target.isSwap({
        data,
        chainId: fromChain,
      });

      expect(result).toBe(false);
    });
  });

  describe('isSwapAndBridge', () => {
    describe('bridge transaction', () => {
      it('should return false when bridging to a different chain', () => {
        const fromChain = faker.string.numeric();
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with(
                'destinationChainId',
                BigInt(faker.string.numeric({ exclude: fromChain })),
              )
              .with('hasSourceSwaps', false)
              .build(),
          )
          .encode();

        const result = target.isSwapAndBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return false when bridging to the same chain', () => {
        const fromChain = faker.string.numeric();
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with('destinationChainId', BigInt(fromChain))
              .with('hasSourceSwaps', false)
              .build(),
          )
          .encode();

        const result = target.isSwapAndBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    describe('swap and bridge transaction', () => {
      it('should return true when swapping to a different chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with(
                'destinationChainId',
                BigInt(faker.string.numeric({ exclude: fromChain })),
              )
              .with('hasSourceSwaps', true)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwapAndBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(true);
      });

      it('should return false when swapping on the same chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with('destinationChainId', BigInt(fromChain))
              .with('hasSourceSwaps', true)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwapAndBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return false when only bridging to a different chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with(
                'destinationChainId',
                BigInt(faker.string.numeric({ exclude: fromChain })),
              )
              .with('hasSourceSwaps', false)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwapAndBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return false when only bridging to the same chain', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with(
            'bridgeData',
            bridgeDataStructBuilder()
              .with('destinationChainId', BigInt(fromChain))
              .with('hasSourceSwaps', false)
              .build(),
          )
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwapAndBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    describe('single swap transaction', () => {
      it('should return false when swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with(
            'swapData',
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          )
          .encode();

        const result = target.isSwapAndBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return false when not swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with(
            'swapData',
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          )
          .encode();

        const result = target.isSwapAndBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    describe('multi swap transaction', () => {
      it('should return false when swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwapAndBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });

      it('should return false when not swapping', () => {
        const fromChain = faker.string.numeric();
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', [
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
            swapDataStructBuilder()
              .with('sendingAssetId', sendingAssetId)
              .with('receivingAssetId', receivingAssetId)
              .build(),
          ])
          .encode();

        const result = target.isSwapAndBridge({
          data,
          chainId: fromChain,
        });

        expect(result).toBe(false);
      });
    });

    it('should return false for a non-LiFi transaction', () => {
      const fromChain = faker.string.numeric();
      const data = faker.string.hexadecimal() as Hex;

      const result = target.isSwapAndBridge({
        data,
        chainId: fromChain,
      });

      expect(result).toBe(false);
    });
  });

  describe('decodeBridgeAndMaybeSwap', () => {
    it('should decode a bridge transaction', () => {
      const transaction = swapAndStartBridgeTokensViaAcrossV3Encoder();
      const args = transaction.build();
      const data = transaction.encode();

      const feeCollectorData = decodeFunctionData({
        abi: LiFiDecoder.FeeCollectorAbi,
        data: args.swapData[0].callData,
      });

      const result = target.decodeBridgeAndMaybeSwap(data);

      expect(result).toStrictEqual({
        transactionId: args.bridgeData.transactionId.toLowerCase(),
        toAddress: args.bridgeData.receiver,
        fromToken: args.bridgeData.sendingAssetId,
        fromAmount: args.bridgeData.minAmount,
        bridge: args.bridgeData.bridge,
        toChain: args.bridgeData.destinationChainId,
        fees: {
          tokenAddress: feeCollectorData.args[0],
          integratorFee: feeCollectorData.args[1],
          lifiFee: feeCollectorData.args[2],
          integratorAddress: feeCollectorData.args[3],
        },
      });
    });

    it('should decode a swap and bridge transaction', () => {
      const fromChain = faker.string.numeric();
      const transaction = swapAndStartBridgeTokensViaAcrossV3Encoder().with(
        'bridgeData',
        bridgeDataStructBuilder()
          .with(
            'destinationChainId',
            BigInt(faker.string.numeric({ exclude: fromChain })),
          )
          .with('hasSourceSwaps', true)
          .build(),
      );
      const args = transaction.build();
      const data = transaction.encode();

      const feeCollectorData = decodeFunctionData({
        abi: LiFiDecoder.FeeCollectorAbi,
        data: args.swapData[0].callData,
      });

      const result = target.decodeBridgeAndMaybeSwap(data);

      expect(result).toStrictEqual({
        transactionId: args.bridgeData.transactionId.toLowerCase(),
        toAddress: args.bridgeData.receiver,
        fromToken: args.bridgeData.sendingAssetId,
        fromAmount: args.bridgeData.minAmount,
        bridge: args.bridgeData.bridge,
        toChain: args.bridgeData.destinationChainId,
        fees: {
          tokenAddress: feeCollectorData.args[0],
          integratorFee: feeCollectorData.args[1],
          lifiFee: feeCollectorData.args[2],
          integratorAddress: feeCollectorData.args[3],
        },
      });
    });
  });

  describe('decodeSwap', () => {
    it('should throw if the calldata is insufficient', () => {
      const data = faker.string.hexadecimal({ length: 964 }) as Hex;

      expect(() => target.decodeSwap(data)).toThrow(
        'Insufficient calldata for a generic swap call',
      );
    });

    it('should decode a single swap transaction', () => {
      const transaction = swapTokensSingleV3ERC20ToERC20Encoder();
      const args = transaction.build();
      const data = transaction.encode();

      const result = target.decodeSwap(data);

      expect(result).toStrictEqual({
        transactionId: args.transactionId.toLowerCase(),
        toAddress: args.receiver,
        fromToken: args.swapData.sendingAssetId,
        toToken: args.swapData.receivingAssetId,
        fromAmount: args.swapData.fromAmount,
        toAmount: args.minAmountOut,
        fees: null,
      });
    });

    it('should decode a multi swap transaction', () => {
      const sendingAssetId = getAddress(faker.finance.ethereumAddress());
      const receivingAssetId = getAddress(faker.finance.ethereumAddress());
      const transaction = swapTokensMultiV3ERC20ToERC20Encoder().with(
        'swapData',
        [
          swapDataStructBuilder()
            .with('sendingAssetId', sendingAssetId)
            .with('receivingAssetId', receivingAssetId)
            .build(),
          swapDataStructBuilder()
            .with('sendingAssetId', sendingAssetId)
            .with('receivingAssetId', receivingAssetId)
            .build(),
          swapDataStructBuilder()
            .with('sendingAssetId', sendingAssetId)
            .with('receivingAssetId', receivingAssetId)
            .build(),
        ],
      );
      const args = transaction.build();
      const data = transaction.encode();

      const result = target.decodeSwap(data);

      expect(result).toStrictEqual({
        transactionId: args.transactionId.toLowerCase(),
        toAddress: args.receiver,
        fromToken: args.swapData[0].sendingAssetId,
        toToken: args.swapData[2].receivingAssetId,
        fromAmount: args.swapData[0].fromAmount,
        toAmount: args.minAmountOut,
        fees: null,
      });
    });
  });
});
