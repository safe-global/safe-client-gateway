import { Injectable } from '@nestjs/common';
import {
  AbiParameterToPrimitiveType,
  Address,
  decodeAbiParameters,
  Hex,
  isAddressEqual,
  parseAbiParameter,
  parseAbiParameters,
} from 'viem';

// Note: the following is heavily inspired by LiFi's CalldataVerificationFacet.sol
// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Facets/CalldataVerificationFacet.sol

@Injectable()
export class LiFiDecoder {
  // ILiFi.BridgeData
  private static readonly BridgeDataStruct = parseAbiParameter(
    '(bytes32 transactionId, string bridge, string integrator, address referrer, address sendingAssetId, address receiver, uint256 minAmount, uint256 destinationChainId, bool hasSourceSwaps, bool hasDestinationCall)',
  );

  // LibSwap.SwapData
  private static readonly SwapDataStruct = parseAbiParameter(
    '(address callTo, address approveTo, address sendingAssetId, address receivingAssetId, uint256 fromAmount, bytes callData, bool requiresDeposit)',
  );
  private static readonly SwapDataStructArr = {
    type: 'tuple[]',
    components: LiFiDecoder.SwapDataStruct.components,
  } as const;

  // swapTokensSingleV3ERC20ToERC20, swapTokensSingleV3ERC20ToNative, swapTokensSingleV3NativeToERC20
  private static readonly SingleSwapFunctionSelectors = [
    '0x4666fc80',
    '0x733214a3',
    '0xaf7060fd',
  ] as const;

  // Initial arguments of all swap* functions
  private static readonly GenericSwapParameters = parseAbiParameters(
    'bytes32 _transactionId, string _integrator, string _referrer, address _receiver, uint256 _minAmountOut',
  );

  constructor(private readonly fromChain: string) {}

  /**
   * Checks if the given calldata represents a (no swap and) bridge call.
   *
   * @param {Hex} data - The calldata to check.
   * @returns {boolean} True if the calldata is a bridge call, false otherwise.
   */
  public isBridge(data: Hex): boolean {
    try {
      const { destinationChainId, hasSourceSwaps } =
        this.decodeBridgeData(data);

      const isBridge = this.fromChain !== destinationChainId.toString();
      return isBridge && !hasSourceSwaps;
    } catch {
      return false;
    }
  }

  /**
   * Checks if the given calldata represents a swap call.
   *
   * @param {Hex} data - The calldata to check.
   * @returns {boolean} True if the calldata is a swap call, false otherwise.
   */
  public isSwap(data: Hex): boolean {
    try {
      const { fromToken, toToken } = this.decodeSwap(data);

      if (!isAddressEqual(fromToken, toToken)) {
        return true;
      }
    } catch {
      // Maybe swap and bridge
    }

    try {
      const { destinationChainId, hasSourceSwaps } =
        this.decodeBridgeData(data);

      const isBridge = this.fromChain !== destinationChainId.toString();
      return !isBridge && hasSourceSwaps;
    } catch {
      return false;
    }
  }

  /**
   * Checks if the given calldata represents a swap and bridge call.
   *
   * @param {Hex} data - The calldata to check.
   * @returns {boolean} True if the calldata is a swap and bridge call, false otherwise.
   */
  public isSwapAndBridge(data: Hex): boolean {
    try {
      const { destinationChainId, hasSourceSwaps } =
        this.decodeBridgeData(data);

      const isBridge = this.fromChain !== destinationChainId.toString();
      return isBridge && hasSourceSwaps;
    } catch {
      return false;
    }
  }

  /**
   * Decodes the bridge data (and swap data) from the given calldata.
   *
   * @param {Hex} data - The calldata to decode.
   * @returns {{
   *   transactionId: Hex,
   *   toAddress: Address,
   *   fromToken: Address,
   *   toToken: Address,
   *   fromAmount: bigint,
   *   bridge: string,
   *   toChain: bigint
   * }} The decoded (swap and) bridge data.
   * @throws {Error} If the calldata is not a (swap and) bridge call call.
   */
  public decodeBridgeAndMaybeSwap(data: Hex): {
    transactionId: Hex;
    toAddress: Address;
    fromToken: Address;
    toToken: Address;
    fromAmount: bigint;
    bridge: string;
    toChain: bigint;
  } {
    const bridgeData = this.decodeBridgeData(data);

    let fromToken: Address;
    let toToken: Address;
    let fromAmount: bigint;

    if (bridgeData.hasSourceSwaps) {
      const [singleSwap] = this.decodeBridgeSwapData(data);
      fromToken = singleSwap.sendingAssetId;
      toToken = singleSwap.receivingAssetId;
      fromAmount = singleSwap.fromAmount;
    } else {
      fromToken = bridgeData.sendingAssetId;
      toToken = bridgeData.sendingAssetId;
      fromAmount = bridgeData.minAmount;
    }

    return {
      transactionId: bridgeData.transactionId,
      toAddress: bridgeData.receiver,
      fromToken,
      toToken,
      fromAmount,
      bridge: bridgeData.bridge,
      toChain: bridgeData.destinationChainId,
    };
  }

  /**
   * Decodes the ILiFi.BridgeData struct from the given calldata.
   *
   * @param {Hex} data - The calldata to decode.
   * @returns {AbiParameterToPrimitiveType<typeof LiFiDecoder.BridgeDataStruct>} The decoded ILiFi.BridgeData struct.
   * @throws {Error} If the calldata is not a (swap and) bridge call.
   */
  private decodeBridgeData(
    data: Hex,
  ): AbiParameterToPrimitiveType<typeof LiFiDecoder.BridgeDataStruct> {
    const [bridgeData] = decodeAbiParameters(
      [LiFiDecoder.BridgeDataStruct],
      this.stripFunctionSelector(data),
    );
    return bridgeData;
  }

  /**
   * Decodes the LibSwap.SwapData struct from the given calldata.
   *
   * @param {Hex} data - The calldata to decode.
   * @returns {Array<AbiParameterToPrimitiveType<typeof LiFiDecoder.SwapDataStruct>>} The decoded LibSwap.SwapData struct.
   * @throws {Error} If the calldata is not a swap and bridge call.
   */
  private decodeBridgeSwapData(
    data: Hex,
  ): Array<AbiParameterToPrimitiveType<typeof LiFiDecoder.SwapDataStruct>> {
    const [, swapData] = decodeAbiParameters(
      [LiFiDecoder.BridgeDataStruct, LiFiDecoder.SwapDataStructArr],
      this.stripFunctionSelector(data),
    );
    return [...swapData];
  }

  /**
   * Decodes the swap data from the given calldata.
   *
   * @param {Hex} data - The calldata to decode.
   * @returns {{
   *   transactionId: Hex,
   *   toAddress: Address,
   *   fromToken: Address,
   *   toToken: Address,
   *   fromAmount: bigint,
   *   toAmount: bigint
   * }} The decoded swap data.
   * @throws {Error} If the calldata is not of sufficient length or not a single/generic swap call.
   */
  public decodeSwap(data: Hex): {
    transactionId: Hex;
    toAddress: Address;
    fromToken: Address;
    toToken: Address;
    fromAmount: bigint;
    toAmount: bigint;
  } {
    if (!this.isGenericSwapCalldata(data)) {
      throw new Error('Insufficient calldata for a generic swap call');
    }

    let swapDataArr: Array<
      AbiParameterToPrimitiveType<typeof LiFiDecoder.SwapDataStruct>
    >;

    let transactionId: Hex;
    let toAddress: Address;
    let toAmount: bigint;

    if (this.isSingleSwap(data)) {
      const { _transactionId, _receiver, _minAmountOut, _swapData } =
        this.decodeSingleSwap(data);

      swapDataArr = [_swapData];
      transactionId = _transactionId;
      toAddress = _receiver;
      toAmount = _minAmountOut;
    } else {
      const { _transactionId, _receiver, _minAmountOut, _swapData } =
        this.decodeMultiOrGenericV1Swap(data);

      swapDataArr = [..._swapData];
      transactionId = _transactionId;
      toAddress = _receiver;
      toAmount = _minAmountOut;
    }

    const [firstSwap] = swapDataArr;
    const lastSwap = swapDataArr[swapDataArr.length - 1];

    return {
      transactionId,
      toAddress,
      fromToken: firstSwap.sendingAssetId,
      toToken: lastSwap.receivingAssetId,
      fromAmount: firstSwap.fromAmount,
      toAmount,
    };
  }

  /**
   * Checks if the given calldata has sufficient length to be a generic swap call.
   *
   * @param {Hex} data - The calldata to check.
   * @returns {boolean} True if the calldata is a generic swap call, false otherwise.
   */
  private isGenericSwapCalldata(data: Hex): boolean {
    // Valid calldata for a generic swap should have at least 484 bytes:
    // Function selector:             4 bytes
    // _transactionId:               32 bytes
    // _integrator:                  64 bytes
    // _referrer:                    64 bytes
    // _receiver:                    32 bytes
    // _minAmountOut:                32 bytes
    // _swapData:                   256 bytes
    return (data.length - 2) / 2 >= 484;
  }

  /**
   * Checks if the given calldata represents a single swap call.
   *
   * @param {Hex} data - The calldata to check.
   * @returns {boolean} True if the calldata is a single swap call, false otherwise.
   */
  private isSingleSwap(data: Hex): boolean {
    return LiFiDecoder.SingleSwapFunctionSelectors.some((selector) => {
      return data.startsWith(selector);
    });
  }

  /**
   * Decodes the LibSwap.SwapData struct from the given calldata for a single swap call.
   *
   * @param {Hex} data - The calldata to decode.
   * @returns {{
   *   _transactionId: Hex,
   *   _integrator: string,
   *   _referrer: string,
   *   _receiver: Address,
   *   _minAmountOut: bigint,
   *   _swapData: AbiParameterToPrimitiveType<typeof LiFiDecoder.SwapDataStruct>
   * }} The decoded LibSwap.SwapData struct.
   * @throws {Error} If the calldata is not a single swap call.
   */
  private decodeSingleSwap(data: Hex): {
    _transactionId: Hex;
    _integrator: string;
    _referrer: string;
    _receiver: Address;
    _minAmountOut: bigint;
    _swapData: AbiParameterToPrimitiveType<typeof LiFiDecoder.SwapDataStruct>;
  } {
    const [
      _transactionId,
      _integrator,
      _referrer,
      _receiver,
      _minAmountOut,
      _swapData,
    ] = decodeAbiParameters(
      [...LiFiDecoder.GenericSwapParameters, LiFiDecoder.SwapDataStruct],
      this.stripFunctionSelector(data),
    );

    return {
      _transactionId,
      _integrator,
      _referrer,
      _receiver,
      _minAmountOut,
      _swapData,
    };
  }

  /**
   * Decodes the LibSwap.SwapData[] struct array from the given calldata for a generic swap call.
   *
   * @param {Hex} data - The calldata to decode.
   * @returns {{
   *   _transactionId: Hex,
   *   _integrator: string,
   *   _referrer: string,
   *   _receiver: Address,
   *   _minAmountOut: bigint,
   *   _swapData: AbiParameterToPrimitiveType<typeof LiFiDecoder.SwapDataStructArr>
   * }} The decoded LibSwap.SwapData[] struct array.
   * @throws {Error} If the calldata is not a multi or generic swap V1 call.
   */
  private decodeMultiOrGenericV1Swap(data: Hex): {
    _transactionId: Hex;
    _integrator: string;
    _referrer: string;
    _receiver: Address;
    _minAmountOut: bigint;
    _swapData: AbiParameterToPrimitiveType<
      typeof LiFiDecoder.SwapDataStructArr
    >;
  } {
    const [
      _transactionId,
      _integrator,
      _referrer,
      _receiver,
      _minAmountOut,
      _swapData,
    ] = decodeAbiParameters(
      [...LiFiDecoder.GenericSwapParameters, LiFiDecoder.SwapDataStructArr],
      this.stripFunctionSelector(data),
    );

    return {
      _transactionId,
      _integrator,
      _referrer,
      _receiver,
      _minAmountOut,
      _swapData,
    };
  }

  /**
   * Strips the function selector (the first 4 bytes) from the given calldata.
   *
   * @param {Hex} data - The calldata to process.
   * @returns {Hex} The calldata without the function selector.
   */
  private stripFunctionSelector(data: Hex): Hex {
    return `0x${data.slice(10)}`;
  }
}
