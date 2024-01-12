import {
  Abi,
  ContractEventName,
  DecodeEventLogParameters,
  DecodeFunctionDataParameters,
  Hex,
  decodeEventLog as _decodeEventLog,
  decodeFunctionData as _decodeFunctionData,
} from 'viem';

export abstract class AbiDecoder<TAbi extends Abi | readonly unknown[]> {
  protected constructor(private readonly abi: TAbi) {}

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

  decodeFunctionData<TAbi extends Abi | readonly unknown[]>(
    args: Omit<DecodeFunctionDataParameters<TAbi>, 'abi'>,
  ) {
    return _decodeFunctionData({ ...args, abi: this.abi });
  }
}
