import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import ComposableCoW from '@/abis/composable-cow/ComposableCoW.abi';
import { Injectable } from '@nestjs/common';
import { decodeAbiParameters, isAddressEqual, parseAbiParameters } from 'viem';

/**
 * Decoder for ComposableCow contract with focus on decoding of TWAP (`createWithContext`) orders
 *
 * The CoW SDK was used as a reference for implementation
 * @see https://github.com/cowprotocol/cow-sdk/blob/5aa61a03d2ed9921c5f95522866b2af0ceb1c24d/src/composable/orderTypes/Twap.ts
 */
@Injectable()
export class ComposableCowDecoder extends AbiDecoder<typeof ComposableCoW> {
  private static readonly ComposableCowAddress =
    '0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74';
  private static readonly TwapHandlerAddress =
    '0x6cF1e9cA41f7611dEf408122793c358a3d11E5a5';

  private static readonly TwapStructAbiParameters = parseAbiParameters(
    'address sellToken, address buyToken, address receiver, uint256 partSellAmount, uint256 minPartLimit, uint256 t0, uint256 n, uint256 t, uint256 span, bytes32 appData',
  );

  constructor(private readonly multiSendDecoder: MultiSendDecoder) {
    super(ComposableCoW);
  }

  /**
   * Check if the transaction is a TWAP order, either directly or within a MultiSend
   *
   * @param args.address - the to address of the transaction
   * @param args.data - the data of the transaction
   *
   * @returns true if the transaction is/contains a TWAP order
   */
  isTwapOrder(args: { address: `0x${string}`; data: `0x${string}` }): boolean {
    // Direct call to ComposableCow - extensible Fallback Handler was previously enabled
    if (
      isAddressEqual(args.address, ComposableCowDecoder.ComposableCowAddress)
    ) {
      return this.helpers.isCreateWithContext(args.data);
    }

    // Call to ComposableCow in MultiSend - extensible Fallback Handler likely being enabled in batch
    if (this.multiSendDecoder.helpers.isMultiSend(args.data)) {
      return this.multiSendDecoder
        .mapMultiSendTransactions(args.data)
        .some((transaction) => {
          return this.isTwapOrder({
            address: transaction.to,
            data: transaction.data,
          });
        });
    }

    return false;
  }

  /**
   * Decodes the transaction data if is/contains a TWAP order
   *
   * @param data - the data of the transaction to decode
   *
   * @returns {@link TwapData} if the transaction is/contains a TWAP order, otherwise null
   */
  decodeTwapOrder(data: `0x${string}`): TwapData | null {
    const twapOrder = this.findTwapOrder(data);

    if (!twapOrder) {
      return null;
    }

    const decoded = this.decodeCreateWithContext(data);

    // Will never happen as `findTwapOrder` returns `createWithContext` data but we need appease TypeScript
    if (!decoded) {
      throw new Error('Unable to decode TWAP data');
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
   * Finds a TWAP order within a transaction data if it is/contains a TWAP order
   *
   * @param data - the data of the search in
   *
   * @returns transaction data of TWAP order if found, otherwise null
   */
  private findTwapOrder(data: `0x${string}`): `0x${string}` | null {
    if (this.helpers.isCreateWithContext(data)) {
      return data;
    }

    if (this.multiSendDecoder.helpers.isMultiSend(data)) {
      const transactions = this.multiSendDecoder.mapMultiSendTransactions(data);

      for (const transaction of transactions) {
        if (this.helpers.isCreateWithContext(data)) {
          return transaction.data;
        }
      }
    }

    return null;
  }

  /**
   * Decodes `createWithContext` data if it is said call
   *
   * @param data - transaction data to decode
   *
   * @returns tuple with arguments of `createWithContext` if it of that, otherwise null:
   * - [0] The parameters of the conditional order
   * - [1] A factory from which to get a value to store in the cabinet
   * - [2] Implementation specific off-chain data
   * - [3] Whether to dispatch the `ConditionalOrderCreated` event
   *
   * @see https://github.com/cowprotocol/composable-cow/blob/24d556b634e21065e0ee70dd27469a6e699a8998/src/ComposableCoW.sol#L130-L135
   */
  // Use inferred types from ABI
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
   * Decodes conditional order parameters (of a TWAP order)
   *
   * @param staticInput - IConditionalOrder.ConditionalOrderParams calldata
   *
   * @returns {@link TwapData} decoded from the static input
   */
  private decodeConditionalOrderParams(
    staticInput: `0x${string}`, // IConditionalOrder.ConditionalOrderParams calldata
  ): TwapData {
    const [
      sellToken,
      buyToken,
      receiver,
      partSellAmount,
      minPartLimit,
      startEpoch, // t0
      numberOfParts, // n
      timeBetweenParts, // t
      span,
      appData,
    ] = decodeAbiParameters(
      ComposableCowDecoder.TwapStructAbiParameters,
      staticInput,
    );

    const isSpanZero = span === BigInt(0);

    const durationOfPart: DurationOfPart = isSpanZero
      ? { durationType: DurationType.AUTO }
      : { durationType: DurationType.LIMIT_DURATION, duration: span };

    const startTime: StartTime = isSpanZero
      ? { startType: StartTimeValue.AT_MINING_TIME }
      : { startType: StartTimeValue.AT_EPOCH, epoch: startEpoch };

    return {
      sellToken,
      buyToken,
      receiver,
      sellAmount: partSellAmount * numberOfParts,
      buyAmount: minPartLimit * numberOfParts,
      startTime,
      numberOfParts,
      timeBetweenParts,
      durationOfPart,
      appData, // TODO: Decode?
    };
  }
}

interface TwapData {
  /**
   * Meta-data associated with the order. Normally would be the keccak256 hash of the document generated in http://github.com/cowprotocol/app-data
   *
   * This hash should have been uploaded to the API https://api.cow.fi/docs/#/default/put_api_v1_app_data__app_data_hash_ and potentially to other data availability protocols like IPFS.
   *
   */
  readonly appData: string;

  /**
   * minimum amount of buyToken that must be bought across the entire TWAP
   */
  readonly buyAmount: bigint;

  /**
   * which token to buy
   */
  readonly buyToken: string;

  /**
   * whether the TWAP is valid for the entire interval or not
   */
  readonly durationOfPart?: DurationOfPart;

  /**
   * number of parts
   */
  readonly numberOfParts: bigint;

  /**
   * who to send the tokens to
   */
  readonly receiver: string;

  /**
   * total amount of sellToken to sell across the entire TWAP
   */
  readonly sellAmount: bigint;

  /**
   * which token to sell
   */
  readonly sellToken: string;

  /**
   * start time of the TWAP
   */
  readonly startTime?: StartTime;

  /**
   * duration of the TWAP interval
   */
  readonly timeBetweenParts: bigint;
}

type DurationOfPart =
  | { durationType: DurationType.AUTO }
  | { durationType: DurationType.LIMIT_DURATION; duration: bigint };

enum DurationType {
  AUTO = 'AUTO',
  LIMIT_DURATION = 'LIMIT_DURATION',
}

type StartTime =
  | { startType: StartTimeValue.AT_MINING_TIME }
  | { startType: StartTimeValue.AT_EPOCH; epoch: bigint };

enum StartTimeValue {
  AT_MINING_TIME = 'AT_MINING_TIME',
  AT_EPOCH = 'AT_EPOCH',
}
