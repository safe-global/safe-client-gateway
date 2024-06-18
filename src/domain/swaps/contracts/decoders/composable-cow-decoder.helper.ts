import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import ComposableCoW from '@/abis/composable-cow/ComposableCoW.abi';
import { Injectable } from '@nestjs/common';
import { decodeAbiParameters, isAddressEqual, parseAbiParameters } from 'viem';

/**
 * Decoder for ComposableCow contract which focuses on decoding TWAP (`createWithContext`) orders
 *
 * The following is based on teh CoW SDK implementation:
 * @see https://github.com/cowprotocol/cow-sdk/blob/5aa61a03d2ed9921c5f95522866b2af0ceb1c24d/src/composable/orderTypes/Twap.ts
 */
@Injectable()
export class ComposableCowDecoder extends AbiDecoder<typeof ComposableCoW> {
  // Address of the TWAP handler contract
  private static readonly TwapHandlerAddress =
    '0x6cF1e9cA41f7611dEf408122793c358a3d11E5a5';

  // Define the ABI of the TwapStruct
  private static readonly TwapStructAbiParameters = parseAbiParameters(
    'address sellToken, address buyToken, address receiver, uint256 partSellAmount, uint256 minPartLimit, uint256 t0, uint256 n, uint256 t, uint256 span, bytes32 appData',
  );

  constructor() {
    super(ComposableCoW);
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
