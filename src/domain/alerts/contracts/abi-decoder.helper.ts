import {
  Abi,
  DecodeEventLogParameters,
  DecodeFunctionDataParameters,
  Hex,
  decodeEventLog as _decodeEventLog,
  decodeFunctionData as _decodeFunctionData,
} from 'viem';
import { ILoggingService } from '@/logging/logging.interface';

export class AbiDecoder<TAbi extends Abi | readonly unknown[]> {
  abi: TAbi;

  constructor(
    private readonly loggingService: ILoggingService,
    abi: TAbi,
  ) {
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
    try {
      return _decodeEventLog({
        ...args,
        abi: this.abi,
      });
    } catch {
      this.loggingService.warn({
        type: 'invalid_event_log',
        data: args.data,
        topics: args.topics,
      });
    }
  }

  decodeFunctionData<TAbi extends Abi | readonly unknown[]>(
    args: Omit<DecodeFunctionDataParameters<TAbi>, 'abi'>,
  ) {
    try {
      return _decodeFunctionData({ ...args, abi: this.abi });
    } catch {
      this.loggingService.warn({
        type: 'invalid_function_data',
        data: args.data,
      });
    }
  }
}
