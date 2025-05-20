import { faker } from '@faker-js/faker';
import { encodeFunctionData, getAddress, parseAbi } from 'viem';
import type { AbiParameter, AbiParameterToPrimitiveType, Hex } from 'viem';
import type { ParseStructs } from 'abitype/dist/types/human-readable/types/structs';

import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
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

export function bridgeDataStructBuilder<
  T extends BridgeDataStructArgs,
>(): IBuilder<T> {
  return new Builder<T>()
    .with('transactionId', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('bridge', faker.word.noun())
    .with('integrator', faker.word.noun())
    .with('referrer', getAddress(faker.finance.ethereumAddress()))
    .with('sendingAssetId', getAddress(faker.finance.ethereumAddress()))
    .with('receiver', getAddress(faker.finance.ethereumAddress()))
    .with('minAmount', faker.number.bigInt())
    .with('destinationChainId', BigInt(faker.string.numeric()))
    .with('hasSourceSwaps', false)
    .with('hasDestinationCall', faker.datatype.boolean());
}

export function acrossV3DataStructBuilder<
  T extends AcrossV3DataStructArgs,
>(): IBuilder<T> {
  return new Builder<T>()
    .with('receiverAddress', getAddress(faker.finance.ethereumAddress()))
    .with('refundAddress', getAddress(faker.finance.ethereumAddress()))
    .with('receivingAssetId', getAddress(faker.finance.ethereumAddress()))
    .with('outputAmount', faker.number.bigInt())
    .with('outputAmountPercent', faker.number.bigInt())
    .with('exclusiveRelayer', getAddress(faker.finance.ethereumAddress()))
    .with('quoteTimestamp', fake32BitInt())
    .with('fillDeadline', fake32BitInt())
    .with('exclusivityDeadline', fake32BitInt())
    .with('message', faker.string.hexadecimal() as Hex);
}

export function swapDataStructBuilder<
  T extends SwapDataStructArgs,
>(): IBuilder<T> {
  return new Builder<T>()
    .with('callTo', getAddress(faker.finance.ethereumAddress()))
    .with('approveTo', getAddress(faker.finance.ethereumAddress()))
    .with('sendingAssetId', getAddress(faker.finance.ethereumAddress()))
    .with('receivingAssetId', getAddress(faker.finance.ethereumAddress()))
    .with('fromAmount', faker.number.bigInt())
    .with('callData', faker.string.hexadecimal({ length: 130 }) as Hex)
    .with('requiresDeposit', faker.datatype.boolean());
}

// Bridge

// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Facets/AcrossFacetV3.sol#L67-L70
const startBridgeTokensViaAcrossV3Abi = parseAbi([
  'function startBridgeTokensViaAcrossV3(BridgeData memory _bridgeData, AcrossV3Data calldata _acrossData)',
  BridgeDataStruct,
  AcrossV3DataStruct,
]);

type StartBridgeTokensViaAcrossV3Args = {
  bridgeData: BridgeDataStructArgs;
  acrossData: AcrossV3DataStructArgs;
};

class StartBridgeTokensViaAcrossV3Encoder<
    T extends StartBridgeTokensViaAcrossV3Args,
  >
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const { bridgeData, acrossData } = this.build();

    return encodeFunctionData({
      abi: startBridgeTokensViaAcrossV3Abi,
      functionName: 'startBridgeTokensViaAcrossV3',
      args: [bridgeData, acrossData],
    });
  }
}

export function startBridgeTokensViaAcrossV3Encoder(): StartBridgeTokensViaAcrossV3Encoder<StartBridgeTokensViaAcrossV3Args> {
  const bridgeDataStruct = bridgeDataStructBuilder().build();

  return new StartBridgeTokensViaAcrossV3Encoder()
    .with('bridgeData', bridgeDataStructBuilder().build())
    .with(
      'acrossData',
      acrossV3DataStructBuilder()
        .with('receivingAssetId', bridgeDataStruct.sendingAssetId)
        .build(),
    );
}

// Swap and bridge

// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Facets/AcrossFacetV3.sol#L89-L93
const swapAndStartBridgeTokensViaAcrossV3Abi = parseAbi([
  'function swapAndStartBridgeTokensViaAcrossV3(BridgeData memory _bridgeData, SwapData[] calldata _swapData, AcrossV3Data calldata _acrossData)',
  BridgeDataStruct,
  SwapDataStruct,
  AcrossV3DataStruct,
]);

type SwapAndStartBridgeTokensViaAcrossV3Args = {
  bridgeData: BridgeDataStructArgs;
  swapData: SwapDataStructArgs;
  acrossData: AcrossV3DataStructArgs;
};

class SwapAndStartBridgeTokensViaAcrossV3Encoder<
    T extends SwapAndStartBridgeTokensViaAcrossV3Args,
  >
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const { bridgeData, swapData, acrossData } = this.build();

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
  const bridgeData = bridgeDataStructBuilder().build();

  return new SwapAndStartBridgeTokensViaAcrossV3Encoder()
    .with('bridgeData', bridgeData)
    .with(
      'swapData',
      swapDataStructBuilder()
        .with('sendingAssetId', bridgeData.sendingAssetId)
        .build(),
    )
    .with('acrossData', acrossV3DataStructBuilder().build());
}

// Single swap

// Note: whilst there are three swap methods: ERC-20 -> ERC-20, ERC-20 -> native, and native -> ERC-20, they all have the same function signature
// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Facets/GenericSwapFacetV3.sol#L40-L47
const swapTokensSingleV3ERC20ToERC20Abi = parseAbi([
  'function swapTokensSingleV3ERC20ToERC20(bytes32 _transactionId, string calldata _integrator, string calldata _referrer, address _receiver, uint256 _minAmountOut, SwapData _swapData)',
  SwapDataStruct,
]);

type SwapTokensSingleV3ERC20ToERC20Args = {
  transactionId: Hex;
  integrator: string;
  referrer: string;
  receiver: Hex;
  minAmountOut: bigint;
  swapData: SwapDataStructArgs;
};

class SwapTokensSingleV3ERC20ToERC20Encoder<
    T extends SwapTokensSingleV3ERC20ToERC20Args,
  >
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const {
      transactionId,
      integrator,
      referrer,
      receiver,
      minAmountOut,
      swapData,
    } = this.build();

    return encodeFunctionData({
      abi: swapTokensSingleV3ERC20ToERC20Abi,
      functionName: 'swapTokensSingleV3ERC20ToERC20',
      args: [
        transactionId,
        integrator,
        referrer,
        receiver,
        minAmountOut,
        swapData,
      ],
    });
  }
}

export function swapTokensSingleV3ERC20ToERC20Encoder(): SwapTokensSingleV3ERC20ToERC20Encoder<SwapTokensSingleV3ERC20ToERC20Args> {
  return new SwapTokensSingleV3ERC20ToERC20Encoder()
    .with('transactionId', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('integrator', faker.word.noun())
    .with('referrer', faker.word.noun())
    .with('receiver', getAddress(faker.finance.ethereumAddress()))
    .with('minAmountOut', faker.number.bigInt())
    .with('swapData', swapDataStructBuilder().build());
}

// Multi swap

// Note: whilst there are three swap methods: ERC-20 -> ERC-20, ERC-20 -> native, and native -> ERC-20, they all have the same function signature
// @see https://github.com/lifinance/contracts/blob/ff6db3da31586336512ef517315238052e8e4b86/src/Facets/GenericSwapFacetV3.sol#L249-L256
const swapTokensMultiV3ERC20ToERC20Abi = parseAbi([
  'function swapTokensMultipleV3ERC20ToERC20(bytes32 _transactionId, string calldata _integrator, string calldata _referrer, address _receiver, uint256 _minAmountOut, SwapData[] calldata _swapData)',
  SwapDataStruct,
]);

type SwapTokensMultiV3ERC20ToERC20Args = {
  transactionId: Hex;
  integrator: string;
  referrer: string;
  receiver: Hex;
  minAmountOut: bigint;
  swapData: Array<SwapDataStructArgs>;
};

class SwapTokensMultiV3ERC20ToERC20Encoder<
    T extends SwapTokensMultiV3ERC20ToERC20Args,
  >
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const {
      transactionId,
      integrator,
      referrer,
      receiver,
      minAmountOut,
      swapData,
    } = this.build();

    return encodeFunctionData({
      abi: swapTokensMultiV3ERC20ToERC20Abi,
      functionName: 'swapTokensMultipleV3ERC20ToERC20',
      args: [
        transactionId,
        integrator,
        referrer,
        receiver,
        minAmountOut,
        swapData,
      ],
    });
  }
}

export function swapTokensMultiV3ERC20ToERC20Encoder(): SwapTokensMultiV3ERC20ToERC20Encoder<SwapTokensMultiV3ERC20ToERC20Args> {
  return new SwapTokensMultiV3ERC20ToERC20Encoder()
    .with('transactionId', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('integrator', faker.word.noun())
    .with('referrer', faker.word.noun())
    .with('receiver', getAddress(faker.finance.ethereumAddress()))
    .with('minAmountOut', faker.number.bigInt())
    .with(
      'swapData',
      faker.helpers.multiple(() => swapDataStructBuilder().build(), {
        count: { min: 2, max: 5 },
      }),
    );
}
