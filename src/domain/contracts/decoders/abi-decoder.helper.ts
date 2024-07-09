import { capitalize } from '@/domain/common/utils/utils';
import { ILoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import {
  Abi,
  AbiFunction,
  AbiStateMutability,
  ContractEventArgsFromTopics,
  ContractEventName,
  ContractFunctionArgs,
  ContractFunctionName,
  decodeEventLog,
  decodeFunctionData,
  toFunctionSelector,
} from 'viem';

// Helpers

type Helper<TAbi extends Abi> = `is${Capitalize<ContractFunctionName<TAbi>>}`;

type Helpers<TAbi extends Abi> = {
  [key in Helper<TAbi>]: (data: `0x${string}`) => boolean;
};

// Function data decoders

type FunctionDataDecoder<TAbi extends Abi> = ContractFunctionName<TAbi>;

type FunctionDataDecoders<TAbi extends Abi> = {
  [key in FunctionDataDecoder<TAbi>]: (
    data: `0x${string}`,
  ) => ContractFunctionArgs<TAbi, AbiStateMutability, key>;
};

// Event log decoders

type EventLogDecoder<TAbi extends Abi> = ContractEventName<TAbi>;

type EventLogDecoders<TAbi extends Abi> = {
  [key in EventLogDecoder<TAbi>]: (args: {
    data: `0x${string}`;
    topics: [signature: `0x${string}`, ...args: Array<`0x${string}`>] | [];
  }) => ContractEventArgsFromTopics<TAbi, key>;
};

export abstract class AbiDecoder<TAbi extends Abi> {
  readonly helpers: Helpers<TAbi>;
  readonly decodeEventLog: EventLogDecoders<TAbi>;
  readonly decodeFunctionData: FunctionDataDecoders<TAbi>;

  protected constructor(
    readonly loggingService: ILoggingService,
    readonly abi: TAbi,
  ) {
    this.helpers = {} as Helpers<TAbi>;
    this.decodeFunctionData = {} as FunctionDataDecoders<TAbi>;
    this.decodeEventLog = {} as EventLogDecoders<TAbi>;

    for (const item of abi) {
      if (item.type === 'function') {
        const name = item.name as FunctionDataDecoder<TAbi>;

        this.helpers[`is${capitalize(name)}`] = this.createHelper(item);
        this.decodeFunctionData[name] = this.createFunctionDataDecoder(name);
      } else if (item.type === 'event') {
        const name = item.name as EventLogDecoder<TAbi>;

        this.decodeEventLog[name] = this.createEventLogDecoder(name);
      }
    }
  }

  private createHelper(name: AbiFunction) {
    const functionSelector = toFunctionSelector(name);
    return (data: `0x${string}`): boolean => {
      return data.startsWith(functionSelector);
    };
  }

  private createFunctionDataDecoder(name: FunctionDataDecoder<TAbi>) {
    return (
      data: `0x${string}`,
    ): ContractFunctionArgs<
      TAbi,
      AbiStateMutability,
      ContractFunctionName<TAbi>
    > => {
      try {
        const decoded = decodeFunctionData({
          data,
          abi: this.abi,
        });

        if (decoded.functionName !== name) {
          this.loggingService.warn(
            `Attempted to decode function data for ${name} but got ${decoded.functionName}`,
          );
          throw new Error(
            `Function data matches ${decoded.functionName}, not ${name}`,
          );
        }

        return decoded.args as ContractFunctionArgs<
          TAbi,
          AbiStateMutability,
          ContractFunctionName<TAbi>
        >;
      } catch (e) {
        // Function not found in ABI
        this.loggingService.warn(
          `Failed to decode function data for ${name}: ${asError(e).message}`,
        );
        throw e;
      }
    };
  }

  private createEventLogDecoder(name: EventLogDecoder<TAbi>) {
    return (args: {
      data: `0x${string}`;
      topics: [signature: `0x${string}`, ...args: Array<`0x${string}`>] | [];
    }): ContractEventArgsFromTopics<TAbi, ContractEventName<TAbi>> => {
      try {
        const decoded = decodeEventLog({
          abi: this.abi,
          data: args.data,
          topics: args.topics,
        });

        if (decoded.eventName !== name) {
          this.loggingService.warn(
            `Attempted to decode event log for ${name} but got ${decoded.eventName}`,
          );
          throw new Error(`Event matches ${decoded.eventName}, not ${name}`);
        }

        return decoded.args as ContractEventArgsFromTopics<
          TAbi,
          EventLogDecoder<TAbi>
        >;
      } catch (e) {
        // Event not found in ABI
        this.loggingService.warn(
          `Failed to decode event log for ${name}: ${asError(e).message}`,
        );
        throw e;
      }
    };
  }
}
