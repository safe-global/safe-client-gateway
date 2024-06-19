import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { Injectable } from '@nestjs/common';
import { decodeAbiParameters, isAddressEqual, parseAbiParameters } from 'viem';

/**
 * Taken from CoW SDK:
 *
 * @see https://github.com/cowprotocol/cow-sdk/blob/5aa61a03d2ed9921c5f95522866b2af0ceb1c24d/abi/ComposableCoW.json
 *
 * TODO: We should locate this in @/abis/... but we will need to refactor the /scripts/generate-abis.js
 * to handle ABIs that are present (or alternatively install the @cowprotocol/contracts package and generate
 * the ABIs from there)
 */
export const ComposableCowAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_settlement',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'InterfaceNotSupported',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidHandler',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ProofNotAuthed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'SingleOrderNotAuthed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'SwapGuardRestricted',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'contract IConditionalOrder',
            name: 'handler',
            type: 'address',
          },
          {
            internalType: 'bytes32',
            name: 'salt',
            type: 'bytes32',
          },
          {
            internalType: 'bytes',
            name: 'staticInput',
            type: 'bytes',
          },
        ],
        indexed: false,
        internalType: 'struct IConditionalOrder.ConditionalOrderParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'ConditionalOrderCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'root',
        type: 'bytes32',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'location',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
        ],
        indexed: false,
        internalType: 'struct ComposableCoW.Proof',
        name: 'proof',
        type: 'tuple',
      },
    ],
    name: 'MerkleRootSet',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'contract ISwapGuard',
        name: 'swapGuard',
        type: 'address',
      },
    ],
    name: 'SwapGuardSet',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    name: 'cabinet',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'contract IConditionalOrder',
            name: 'handler',
            type: 'address',
          },
          {
            internalType: 'bytes32',
            name: 'salt',
            type: 'bytes32',
          },
          {
            internalType: 'bytes',
            name: 'staticInput',
            type: 'bytes',
          },
        ],
        internalType: 'struct IConditionalOrder.ConditionalOrderParams',
        name: 'params',
        type: 'tuple',
      },
      {
        internalType: 'bool',
        name: 'dispatch',
        type: 'bool',
      },
    ],
    name: 'create',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'contract IConditionalOrder',
            name: 'handler',
            type: 'address',
          },
          {
            internalType: 'bytes32',
            name: 'salt',
            type: 'bytes32',
          },
          {
            internalType: 'bytes',
            name: 'staticInput',
            type: 'bytes',
          },
        ],
        internalType: 'struct IConditionalOrder.ConditionalOrderParams',
        name: 'params',
        type: 'tuple',
      },
      {
        internalType: 'contract IValueFactory',
        name: 'factory',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        internalType: 'bool',
        name: 'dispatch',
        type: 'bool',
      },
    ],
    name: 'createWithContext',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'domainSeparator',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'contract IConditionalOrder',
            name: 'handler',
            type: 'address',
          },
          {
            internalType: 'bytes32',
            name: 'salt',
            type: 'bytes32',
          },
          {
            internalType: 'bytes',
            name: 'staticInput',
            type: 'bytes',
          },
        ],
        internalType: 'struct IConditionalOrder.ConditionalOrderParams',
        name: 'params',
        type: 'tuple',
      },
      {
        internalType: 'bytes',
        name: 'offchainInput',
        type: 'bytes',
      },
      {
        internalType: 'bytes32[]',
        name: 'proof',
        type: 'bytes32[]',
      },
    ],
    name: 'getTradeableOrderWithSignature',
    outputs: [
      {
        components: [
          {
            internalType: 'contract IERC20',
            name: 'sellToken',
            type: 'address',
          },
          {
            internalType: 'contract IERC20',
            name: 'buyToken',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'receiver',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'sellAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'buyAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint32',
            name: 'validTo',
            type: 'uint32',
          },
          {
            internalType: 'bytes32',
            name: 'appData',
            type: 'bytes32',
          },
          {
            internalType: 'uint256',
            name: 'feeAmount',
            type: 'uint256',
          },
          {
            internalType: 'bytes32',
            name: 'kind',
            type: 'bytes32',
          },
          {
            internalType: 'bool',
            name: 'partiallyFillable',
            type: 'bool',
          },
          {
            internalType: 'bytes32',
            name: 'sellTokenBalance',
            type: 'bytes32',
          },
          {
            internalType: 'bytes32',
            name: 'buyTokenBalance',
            type: 'bytes32',
          },
        ],
        internalType: 'struct GPv2Order.Data',
        name: 'order',
        type: 'tuple',
      },
      {
        internalType: 'bytes',
        name: 'signature',
        type: 'bytes',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'contract IConditionalOrder',
            name: 'handler',
            type: 'address',
          },
          {
            internalType: 'bytes32',
            name: 'salt',
            type: 'bytes32',
          },
          {
            internalType: 'bytes',
            name: 'staticInput',
            type: 'bytes',
          },
        ],
        internalType: 'struct IConditionalOrder.ConditionalOrderParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'hash',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract Safe',
        name: 'safe',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
      {
        internalType: 'bytes32',
        name: '_hash',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: '_domainSeparator',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: 'encodeData',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'payload',
        type: 'bytes',
      },
    ],
    name: 'isValidSafeSignature',
    outputs: [
      {
        internalType: 'bytes4',
        name: 'magic',
        type: 'bytes4',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'singleOrderHash',
        type: 'bytes32',
      },
    ],
    name: 'remove',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'roots',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'root',
        type: 'bytes32',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'location',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
        ],
        internalType: 'struct ComposableCoW.Proof',
        name: 'proof',
        type: 'tuple',
      },
    ],
    name: 'setRoot',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'root',
        type: 'bytes32',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'location',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
        ],
        internalType: 'struct ComposableCoW.Proof',
        name: 'proof',
        type: 'tuple',
      },
      {
        internalType: 'contract IValueFactory',
        name: 'factory',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'setRootWithContext',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract ISwapGuard',
        name: 'swapGuard',
        type: 'address',
      },
    ],
    name: 'setSwapGuard',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    name: 'singleOrders',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'swapGuards',
    outputs: [
      {
        internalType: 'contract ISwapGuard',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Decoder for ComposableCow contract which focuses on decoding TWAP (`createWithContext`) orders
 *
 * The following is based on teh CoW SDK implementation:
 * @see https://github.com/cowprotocol/cow-sdk/blob/5aa61a03d2ed9921c5f95522866b2af0ceb1c24d/src/composable/orderTypes/Twap.ts
 */
@Injectable()
export class ComposableCowDecoder extends AbiDecoder<typeof ComposableCowAbi> {
  // Address of the TWAP handler contract
  private static readonly TwapHandlerAddress =
    '0x6cF1e9cA41f7611dEf408122793c358a3d11E5a5';

  // Define the ABI of the TwapStruct
  private static readonly TwapStructAbiParameters = parseAbiParameters(
    'address sellToken, address buyToken, address receiver, uint256 partSellAmount, uint256 minPartLimit, uint256 t0, uint256 n, uint256 t, uint256 span, bytes32 appData',
  );

  constructor() {
    super(ComposableCowAbi);
  }

  /**
   * Decode {@link TwapStruct} from `createWithContext` data
   * @param data - transaction data to decode
   * @returns the decoded {@link TwapStruct}
   */
  decodeTwapStruct(data: `0x${string}`): TwapStruct {
    const decoded = this.decodeCreateWithContext(data);

    if (!decoded) {
      throw new Error('Unable to decode `createWithContext` data');
    }

    const [params] = decoded;

    if (
      !isAddressEqual(params.handler, ComposableCowDecoder.TwapHandlerAddress)
    ) {
      throw new Error('Invalid TWAP handler');
    }

    return this.decodeConditionalOrderParams(params.staticInput);
  }

  /**
   * Decode the `createWithContext` data to tuple of parameters
   * @param data - transaction data to decode
   * @returns decoded parameters passed to `createWithContext`
   */
  // Use inferred return type
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private decodeCreateWithContext(data: `0x${string}`) {
    if (!this.helpers.isCreateWithContext(data)) {
      return null;
    }

    try {
      const decoded = this.decodeFunctionData({
        data,
      });

      if (decoded.functionName !== 'createWithContext') {
        throw new Error('Data is not of createWithContext');
      }

      return decoded.args;
    } catch {
      return null;
    }
  }

  /**
   * Decode the `ConditionalOrderParams` from `createWithContext` data
   * @param staticInput - `staticInput` of `createWithContext` call
   * @returns decoded `ConditionalOrderParams` as {@link TwapStruct}
   */
  private decodeConditionalOrderParams(
    staticInput: `0x${string}`, // IConditionalOrder.ConditionalOrderParams calldata
  ): TwapStruct {
    const [
      sellToken,
      buyToken,
      receiver,
      partSellAmount,
      minPartLimit,
      t0,
      n,
      t,
      span,
      appData,
    ] = decodeAbiParameters(
      ComposableCowDecoder.TwapStructAbiParameters,
      staticInput,
    );

    return {
      sellToken,
      buyToken,
      receiver,
      partSellAmount,
      minPartLimit,
      t0,
      n,
      t,
      span,
      appData,
    };
  }
}

/**
 * Model of the contract's struct used for `staticIntput` of the `createWithContext` function
 * @see https://docs.cow.fi/cow-protocol/reference/sdks/cow-sdk/interfaces/TwapStruct
 */
export type TwapStruct = {
  /**
   * which token to sell
   */
  readonly sellToken: `0x${string}`;

  /**
   * which token to buy
   */
  readonly buyToken: `0x${string}`;

  /**
   * who to send the tokens to
   */
  readonly receiver: `0x${string}`;

  /**
   * Meta-data associated with the order. Normally would be the keccak256 hash of the document generated in http://github.com/cowprotocol/app-data
   *
   * This hash should have been uploaded to the API https://api.cow.fi/docs/#/default/put_api_v1_app_data__app_data_hash_ and potentially to other data availability protocols like IPFS.
   *
   */
  readonly appData: `0x${string}`;

  /**
   * amount of sellToken to sell in each part
   */
  readonly partSellAmount: bigint;

  /**
   * minimum amount of buyToken that must be bought in each part
   */
  readonly minPartLimit: bigint;

  /**
   * start time of the TWAP
   */
  readonly t0: bigint;

  /**
   * number of parts
   */
  readonly n: bigint;

  /**
   * duration of the TWAP interval
   */
  readonly t: bigint;

  /**
   * whether the TWAP is valid for the entire interval or not
   */
  readonly span: bigint;
};
