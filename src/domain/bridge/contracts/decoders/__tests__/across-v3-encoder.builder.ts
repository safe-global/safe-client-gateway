import { faker } from '@faker-js/faker';
import { encodeFunctionData, getAddress, parseAbi } from 'viem';
import type { AbiParameter, AbiParameterToPrimitiveType, Hex } from 'viem';
import type { ParseStructs } from 'abitype/dist/types/human-readable/types/structs';

import { Builder } from '@/__tests__/builder';
import type { IEncoder } from '@/__tests__/encoder-builder';

// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Interfaces/ILiFi.sol#L10-L21
const BridgeDataStruct =
  'struct BridgeData { bytes32 transactionId; string bridge; string integrator; address referrer; address sendingAssetId; address receiver; uint256 minAmount; uint256 destinationChainId; bool hasSourceSwaps; bool hasDestinationCall; }';
type BridgeDataStructArgs = ParametersToObject<
  ParseStructs<[typeof BridgeDataStruct]>['BridgeData']
>;

// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Facets/AcrossFacetV3.sol#L39-L50
const AcrossV3DataStruct =
  'struct AcrossV3Data { address receiverAddress; address refundAddress; address receivingAssetId; uint256 outputAmount; uint64 outputAmountPercent; address exclusiveRelayer; uint32 quoteTimestamp; uint32 fillDeadline; uint32 exclusivityDeadline; bytes message; }';
type AcrossV3DataStructArgs = ParametersToObject<
  ParseStructs<[typeof AcrossV3DataStruct]>['AcrossV3Data']
>;

// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Libraries/LibSwap.sol#L11-L19
const SwapDataStruct =
  'struct SwapData { address callTo; address approveTo; address sendingAssetId; address receivingAssetId; uint256 fromAmount; bytes callData; bool requiresDeposit; }';
type SwapDataStructArgs = ParametersToObject<
  ParseStructs<[typeof SwapDataStruct]>['SwapData']
>;

type ParametersToObject<T extends ReadonlyArray<AbiParameter>> = {
  [P in T[number] as P['name'] extends string
    ? P['name']
    : never]: AbiParameterToPrimitiveType<P>;
};

function fake32BitInt(): number {
  const MAX_SAFE_32_BIT_INT = 4294967295;
  return faker.number.int({
    min: 0,
    max: MAX_SAFE_32_BIT_INT,
  });
}

// Bridge

// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Facets/AcrossFacetV3.sol#L67-L70
const startBridgeTokensViaAcrossV3Abi = parseAbi([
  `function startBridgeTokensViaAcrossV3(BridgeData memory _bridgeData, AcrossV3Data calldata _acrossData)`,
  BridgeDataStruct,
  AcrossV3DataStruct,
]);

type StartBridgeTokensViaAcrossV3Args = {
  bridgeData: Partial<BridgeDataStructArgs>;
  acrossData: Partial<AcrossV3DataStructArgs>;
};

class StartBridgeTokensViaAcrossV3Encoder<
    T extends StartBridgeTokensViaAcrossV3Args,
  >
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    const sendingAssetId = getAddress(faker.finance.ethereumAddress());
    const hasSourceSwaps = false;
    const receivingAssetId = sendingAssetId;

    const bridgeData: BridgeDataStructArgs = {
      transactionId: faker.string.hexadecimal({ length: 64 }) as Hex,
      bridge: faker.word.noun(),
      integrator: faker.word.noun(),
      referrer: getAddress(faker.finance.ethereumAddress()),
      sendingAssetId,
      receiver: getAddress(faker.finance.ethereumAddress()),
      minAmount: faker.number.bigInt(),
      destinationChainId: BigInt(faker.string.numeric()),
      hasSourceSwaps,
      hasDestinationCall: faker.datatype.boolean(),
      ...args.bridgeData,
    };

    const acrossData: AcrossV3DataStructArgs = {
      receiverAddress: getAddress(faker.finance.ethereumAddress()),
      refundAddress: getAddress(faker.finance.ethereumAddress()),
      receivingAssetId: receivingAssetId,
      outputAmount: faker.number.bigInt(),
      outputAmountPercent: faker.number.bigInt(),
      exclusiveRelayer: getAddress(faker.finance.ethereumAddress()),
      quoteTimestamp: fake32BitInt(),
      fillDeadline: fake32BitInt(),
      exclusivityDeadline: fake32BitInt(),
      message: faker.string.hexadecimal() as Hex,
      ...args.acrossData,
    };

    return encodeFunctionData({
      abi: startBridgeTokensViaAcrossV3Abi,
      functionName: 'startBridgeTokensViaAcrossV3',
      args: [bridgeData, acrossData],
    });
  }
}

export function startBridgeTokensViaAcrossV3Encoder(): StartBridgeTokensViaAcrossV3Encoder<StartBridgeTokensViaAcrossV3Args> {
  return new StartBridgeTokensViaAcrossV3Encoder();
}

// Swap and bridge

// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Facets/AcrossFacetV3.sol#L89-L93
const swapAndStartBridgeTokensViaAcrossV3Abi = parseAbi([
  `function swapAndStartBridgeTokensViaAcrossV3(BridgeData memory _bridgeData, SwapData[] calldata _swapData, AcrossV3Data calldata _acrossData)`,
  BridgeDataStruct,
  SwapDataStruct,
  AcrossV3DataStruct,
]);

type SwapAndStartBridgeTokensViaAcrossV3Args = {
  bridgeData: Partial<BridgeDataStructArgs>;
  swapData: Partial<SwapDataStructArgs>;
  acrossData: Partial<AcrossV3DataStructArgs>;
};

class SwapAndStartBridgeTokensViaAcrossV3Encoder<
    T extends SwapAndStartBridgeTokensViaAcrossV3Args,
  >
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    const sendingAssetId = getAddress(faker.finance.ethereumAddress());
    const hasSourceSwaps = true;
    const receivingAssetId = sendingAssetId;

    const bridgeData: BridgeDataStructArgs = {
      transactionId: faker.string.hexadecimal({ length: 64 }) as Hex,
      bridge: faker.word.noun(),
      integrator: faker.word.noun(),
      referrer: getAddress(faker.finance.ethereumAddress()),
      sendingAssetId,
      receiver: getAddress(faker.finance.ethereumAddress()),
      minAmount: faker.number.bigInt(),
      destinationChainId: BigInt(faker.string.numeric()),
      hasSourceSwaps,
      hasDestinationCall: faker.datatype.boolean(),
      ...args.bridgeData,
    };

    const swapData: SwapDataStructArgs = {
      callTo: getAddress(faker.finance.ethereumAddress()),
      approveTo: getAddress(faker.finance.ethereumAddress()),
      sendingAssetId,
      receivingAssetId,
      fromAmount: faker.number.bigInt(),
      callData: faker.string.hexadecimal() as Hex,
      requiresDeposit: faker.datatype.boolean(),
      ...args.swapData,
    };

    const acrossData: AcrossV3DataStructArgs = {
      receiverAddress: getAddress(faker.finance.ethereumAddress()),
      refundAddress: getAddress(faker.finance.ethereumAddress()),
      receivingAssetId,
      outputAmount: faker.number.bigInt(),
      outputAmountPercent: faker.number.bigInt(),
      exclusiveRelayer: getAddress(faker.finance.ethereumAddress()),
      quoteTimestamp: fake32BitInt(),
      fillDeadline: fake32BitInt(),
      exclusivityDeadline: fake32BitInt(),
      message: faker.string.hexadecimal() as Hex,
      ...args.acrossData,
    };

    return encodeFunctionData({
      abi: swapAndStartBridgeTokensViaAcrossV3Abi,
      functionName: 'swapAndStartBridgeTokensViaAcrossV3',
      args: [
        bridgeData,
        // Swap and bridge transactions only have one source swap
        [swapData],
        acrossData,
      ],
    });
  }
}

export function swapAndStartBridgeTokensViaAcrossV3Encoder(): SwapAndStartBridgeTokensViaAcrossV3Encoder<SwapAndStartBridgeTokensViaAcrossV3Args> {
  return new SwapAndStartBridgeTokensViaAcrossV3Encoder();
}

// Swap

// Note: whilst there are three swap methods: ERC-20 -> ERC-20, ERC-20 -> native, and native -> ERC-20, they all have the same function signature
// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Facets/GenericSwapFacetV3.sol#L40-L47
const swapTokensSingleV3ERC20ToERC20Abi = parseAbi([
  `function swapTokensSingleV3ERC20ToERC20(bytes32 _transactionId, string calldata _integrator, string calldata _referrer, address _receiver, uint256 _minAmountOut, SwapData calldata _swapData)`,
  SwapDataStruct,
]);

type SwapTokensSingleV3ERC20ToERC20Args = Partial<{
  transactionId: Hex;
  integrator: string;
  referrer: string;
  receiver: Hex;
  minAmountOut: bigint;
  swapData: Partial<SwapDataStructArgs>;
}>;

class SwapTokensSingleV3ERC20ToERC20Encoder<
    T extends SwapTokensSingleV3ERC20ToERC20Args,
  >
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const { swapData, ...rest } = this.build();

    const args = {
      transactionId: faker.string.hexadecimal({ length: 64 }) as Hex,
      integrator: faker.word.noun(),
      referrer: faker.word.noun(),
      receiver: getAddress(faker.finance.ethereumAddress()),
      minAmountOut: faker.number.bigInt(),
      swapData: {
        callTo: getAddress(faker.finance.ethereumAddress()),
        approveTo: getAddress(faker.finance.ethereumAddress()),
        sendingAssetId: getAddress(faker.finance.ethereumAddress()),
        receivingAssetId: getAddress(faker.finance.ethereumAddress()),
        fromAmount: faker.number.bigInt(),
        callData: faker.string.hexadecimal() as Hex,
        requiresDeposit: faker.datatype.boolean(),
        ...swapData,
      },
      ...rest,
    };

    return encodeFunctionData({
      abi: swapTokensSingleV3ERC20ToERC20Abi,
      functionName: 'swapTokensSingleV3ERC20ToERC20',
      args: [
        args.transactionId,
        args.integrator,
        args.referrer,
        args.receiver,
        args.minAmountOut,
        args.swapData,
      ],
    });
  }
}

export function swapTokensSingleV3ERC20ToERC20Encoder(): SwapTokensSingleV3ERC20ToERC20Encoder<SwapTokensSingleV3ERC20ToERC20Args> {
  return new SwapTokensSingleV3ERC20ToERC20Encoder();
}
