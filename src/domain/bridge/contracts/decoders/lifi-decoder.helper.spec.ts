import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { Hex } from 'viem';

import { LiFiDecoder } from '@/domain/bridge/contracts/decoders/lifi-decoder.helper';
import {
  startBridgeTokensViaAcrossV3Encoder,
  swapAndStartBridgeTokensViaAcrossV3Encoder,
  swapTokensMultiV3ERC20ToERC20Encoder,
  swapTokensSingleV3ERC20ToERC20Encoder,
} from '@/domain/bridge/contracts/decoders/__tests__/across-v3-encoder.builder';

// Note: whilst the LiFi Diamond contract has multiple facets, the function signatures have
// common parameters. This means that we can safely rely on AcrossV3 for these tests.
describe('LiFiDecoder', () => {
  let target: LiFiDecoder;
  let fromChain: string;

  beforeEach(() => {
    fromChain = faker.string.numeric();
    target = new LiFiDecoder(fromChain);
  });

  describe('isBridge', () => {
    describe('bridge transaction', () => {
      it('should return true when bridging to a different chain', () => {
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(
              faker.string.numeric({ exclude: fromChain }),
            ),
          })
          .encode();

        const result = target.isBridge(data);

        expect(result).toBe(true);
      });

      it('should return false when bridging to the same chain', () => {
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(fromChain),
          })
          .encode();

        const result = target.isBridge(data);

        expect(result).toBe(false);
      });
    });

    describe('swap and bridge transaction', () => {
      it('should return false when swapping to a different chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(
              faker.string.numeric({ exclude: fromChain }),
            ),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isBridge(data);

        expect(result).toBe(false);
      });

      it('should return false when swapping on the same chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(fromChain),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isBridge(data);

        expect(result).toBe(false);
      });

      it('should return true when bridging to a different chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(
              faker.string.numeric({ exclude: fromChain }),
            ),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isBridge(data);

        expect(result).toBe(true);
      });

      it('should return false when bridging to the same chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(fromChain),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isBridge(data);

        expect(result).toBe(false);
      });
    });

    describe('single swap transaction', () => {
      it('should return false when swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isBridge(data);

        expect(result).toBe(false);
      });

      it('should return false when not swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isBridge(data);

        expect(result).toBe(false);
      });
    });

    describe('multi swap transaction', () => {
      it('should return false when swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isBridge(data);

        expect(result).toBe(false);
      });

      it('should return false when not swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isBridge(data);

        expect(result).toBe(false);
      });
    });

    it('should return false for a non-LiFi transaction', () => {
      const data = faker.string.hexadecimal() as Hex;

      const result = target.isBridge(data);

      expect(result).toBe(false);
    });
  });

  describe('isSwap', () => {
    describe('bridge transaction', () => {
      it('should return false when bridging to a different chain', () => {
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(
              faker.string.numeric({ exclude: fromChain }),
            ),
          })
          .encode();

        const result = target.isSwap(data);

        expect(result).toBe(false);
      });

      it('should return false when bridging to the same chain', () => {
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(fromChain),
          })
          .encode();

        const result = target.isSwap(data);

        expect(result).toBe(false);
      });
    });

    describe('swap and bridge transaction', () => {
      it('should return false when swapping to a different chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(
              faker.string.numeric({ exclude: fromChain }),
            ),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwap(data);

        expect(result).toBe(false);
      });

      it('should return true when swapping on the same chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(fromChain),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwap(data);

        expect(result).toBe(true);
      });

      it('should return false when bridging to a different chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(
              faker.string.numeric({ exclude: fromChain }),
            ),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwap(data);

        expect(result).toBe(false);
      });

      it('should return false when bridging to the same chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(fromChain),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwap(data);

        expect(result).toBe(false);
      });
    });

    describe('single swap transaction', () => {
      it('should return true when swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwap(data);

        expect(result).toBe(true);
      });

      it('should return false when not swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwap(data);

        expect(result).toBe(false);
      });
    });

    describe('multi swap transaction', () => {
      it('should return true when swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwap(data);

        expect(result).toBe(true);
      });

      it('should return false when not swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwap(data);

        expect(result).toBe(false);
      });
    });

    it('should return false for a non-LiFi transaction', () => {
      const data = faker.string.hexadecimal() as Hex;

      const result = target.isSwap(data);

      expect(result).toBe(false);
    });
  });

  describe('isSwapAndBridge', () => {
    describe('bridge transaction', () => {
      it('should return false when bridging to a different chain', () => {
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(
              faker.string.numeric({ exclude: fromChain }),
            ),
          })
          .encode();

        const result = target.isSwapAndBridge(data);

        expect(result).toBe(false);
      });

      it('should return false when bridging to the same chain', () => {
        const data = startBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(fromChain),
          })
          .encode();

        const result = target.isSwapAndBridge(data);

        expect(result).toBe(false);
      });
    });

    describe('swap and bridge transaction', () => {
      it('should return true when swapping to a different chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(
              faker.string.numeric({ exclude: fromChain }),
            ),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwapAndBridge(data);

        expect(result).toBe(true);
      });

      it('should return false when swapping on the same chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(fromChain),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwapAndBridge(data);

        expect(result).toBe(false);
      });

      it('should return false when bridging to a different chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(
              faker.string.numeric({ exclude: fromChain }),
            ),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwapAndBridge(data);

        expect(result).toBe(false);
      });

      it('should return false when bridging to the same chain', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapAndStartBridgeTokensViaAcrossV3Encoder()
          .with('bridgeData', {
            destinationChainId: BigInt(fromChain),
          })
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwapAndBridge(data);

        expect(result).toBe(false);
      });
    });

    describe('single swap transaction', () => {
      it('should return false when swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwapAndBridge(data);

        expect(result).toBe(false);
      });

      it('should return false when not swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensSingleV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwapAndBridge(data);

        expect(result).toBe(false);
      });
    });

    describe('multi swap transaction', () => {
      it('should return false when swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = getAddress(faker.finance.ethereumAddress());
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwapAndBridge(data);

        expect(result).toBe(false);
      });

      it('should return false when not swapping', () => {
        const sendingAssetId = getAddress(faker.finance.ethereumAddress());
        const receivingAssetId = sendingAssetId;
        const data = swapTokensMultiV3ERC20ToERC20Encoder()
          .with('swapData', {
            sendingAssetId,
            receivingAssetId,
          })
          .encode();

        const result = target.isSwapAndBridge(data);

        expect(result).toBe(false);
      });
    });

    it('should return false for a non-LiFi transaction', () => {
      const data = faker.string.hexadecimal() as Hex;

      const result = target.isSwapAndBridge(data);

      expect(result).toBe(false);
    });
  });

  it.todo('decodeBridgeAndMaybeSwap');

  it.todo('decodeSwap');
});
