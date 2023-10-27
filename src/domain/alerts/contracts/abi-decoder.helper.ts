import {
  Abi,
  DecodeEventLogParameters,
  DecodeFunctionDataParameters,
  Hex,
  decodeEventLog as _decodeEventLog,
  decodeFunctionData as _decodeFunctionData,
} from 'viem';

export abstract class AbiDecoder<TAbi extends Abi | readonly unknown[]> {
  readonly abi: TAbi;

  constructor(abi: TAbi) {
    this.abi = abi;
  }

  decodeEventLog<
    TEventName extends string | undefined = undefined,
    TTopics extends Hex[] = Hex[],
    TData extends Hex | undefined = undefined,
    TStrict extends boolean = true,
  >(
    args: Omit<
      DecodeEventLogParameters<TAbi, TEventName, TTopics, TData, TStrict>,
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
