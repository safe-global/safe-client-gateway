import {
  Abi,
  ContractEventName,
  ContractFunctionName,
  DecodeEventLogParameters,
  DecodeFunctionDataParameters,
  Hex,
  decodeEventLog as _decodeEventLog,
  decodeFunctionData as _decodeFunctionData,
} from 'viem';

export abstract class AbiDecoder<TAbi extends Abi | readonly unknown[]> {
  protected constructor(private readonly abi: TAbi) {}

  // Use inferred types from viem
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  decodeEventLog<
    const abi extends Abi | readonly unknown[],
    eventName extends ContractEventName<abi> | undefined = undefined,
    topics extends Hex[] = Hex[],
    data extends Hex | undefined = undefined,
    strict extends boolean = true,
  >(
    args: Omit<
      DecodeEventLogParameters<abi, eventName, topics, data, strict>,
      'abi'
    >,
  ) {
    return _decodeEventLog({
      ...args,
      abi: this.abi,
    });
  }

  // Use inferred types from viem
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  decodeFunctionData<TAbi extends Abi | readonly unknown[]>(
    args: Omit<DecodeFunctionDataParameters<TAbi>, 'abi'>,
  ) {
    return _decodeFunctionData({ ...args, abi: this.abi });
  }

  // TODO: Don't expose this but generate is{FunctionName} helpers instead
  _isFunctionCall(args: {
    functionName: ContractFunctionName<TAbi>;
    data: Hex;
  }): boolean {
    try {
      const { functionName } = this.decodeFunctionData({
        data: args.data,
      });
      return functionName === args.functionName;
    } catch {
      return false;
    }
  }
}
