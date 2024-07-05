import {
  Abi,
  AbiFunction,
  AbiStateMutability,
  ContractEventArgsFromTopics,
  ContractEventName,
  ContractFunctionArgs,
  ContractFunctionName,
  Hex,
  decodeEventLog,
  decodeFunctionData,
  toFunctionSelector,
} from 'viem';

export abstract class AbiDecoder<TAbi extends Abi> {
  readonly helpers: Helpers<TAbi>;
  readonly decodeEventLog: EventLogDecoders<TAbi>;
  readonly decodeFunctionData: FunctionDataDecoders<TAbi>;

  protected constructor(readonly abi: TAbi) {
    this.helpers = _generateHelpers(abi);
    this.decodeEventLog = _generateEventLogDecoders(abi);
    this.decodeFunctionData = _generateFunctionDataDecoders(abi);
  }
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}

// Helpers

type Helper<TAbi extends Abi> = `is${Capitalize<ContractFunctionName<TAbi>>}`;

type Helpers<TAbi extends Abi> = {
  [key in Helper<TAbi>]: (data: Hex) => boolean;
};

export function _generateHelpers<TAbi extends Abi>(
  abi: Readonly<TAbi>,
): Helpers<TAbi> {
  const createHelper = (name: AbiFunction) => {
    return (data: Hex): boolean => {
      const functionSelector = toFunctionSelector(name);
      return data.startsWith(functionSelector);
    };
  };

  const helpers = {} as Helpers<TAbi>;

  for (const item of abi) {
    if (item.type === 'function') {
      const name = item.name as FunctionDataDecoder<TAbi>;
      helpers[`is${capitalize(name)}`] = createHelper(item);
    }
  }

  return helpers;
}

// Function data decoders

type FunctionDataDecoder<TAbi extends Abi> = ContractFunctionName<TAbi>;

type FunctionDataDecoders<TAbi extends Abi> = {
  [key in FunctionDataDecoder<TAbi>]: (
    data: Hex,
  ) => ContractFunctionArgs<TAbi, AbiStateMutability, key> | null;
};

export function _generateFunctionDataDecoders<TAbi extends Abi>(
  abi: TAbi,
): FunctionDataDecoders<TAbi> {
  const createFunctionDataDecoder = (name: FunctionDataDecoder<TAbi>) => {
    return (
      data: `0x${string}`,
    ): ContractFunctionArgs<
      TAbi,
      AbiStateMutability,
      ContractFunctionName<TAbi>
    > | null => {
      try {
        const decoded = decodeFunctionData({
          data,
          abi,
        });

        if (decoded.functionName !== name) {
          return null;
        }

        return decoded.args as ContractFunctionArgs<
          TAbi,
          AbiStateMutability,
          ContractFunctionName<TAbi>
        >;
      } catch {
        return null;
      }
    };
  };

  const functionDataDecoders = {} as FunctionDataDecoders<TAbi>;

  for (const item of abi) {
    if (item.type === 'function') {
      const name = item.name as FunctionDataDecoder<TAbi>;
      functionDataDecoders[name] = createFunctionDataDecoder(name);
    }
  }

  return functionDataDecoders;
}

// Event log decoders

type EventLogDecoder<TAbi extends Abi> = ContractEventName<TAbi>;

type EventLogDecoders<TAbi extends Abi> = {
  [key in EventLogDecoder<TAbi>]: (args: {
    data: `0x${string}`;
    topics: [signature: `0x${string}`, ...args: Array<`0x${string}`>] | [];
  }) => ContractEventArgsFromTopics<TAbi, key> | null;
};

export function _generateEventLogDecoders<TAbi extends Abi>(
  abi: TAbi,
): EventLogDecoders<TAbi> {
  const createEventLogDecoder = (name: EventLogDecoder<TAbi>) => {
    return (args: {
      data: `0x${string}`;
      topics: [signature: `0x${string}`, ...args: Array<`0x${string}`>] | [];
    }): ContractEventArgsFromTopics<TAbi, ContractEventName<TAbi>> | null => {
      try {
        const decoded = decodeEventLog({
          abi,
          data: args.data,
          topics: args.topics,
        });

        if (decoded.eventName !== name) {
          return null;
        }

        return decoded.args as ContractEventArgsFromTopics<
          TAbi,
          EventLogDecoder<TAbi>
        >;
      } catch {
        return null;
      }
    };
  };

  const eventLogDecoders = {} as EventLogDecoders<TAbi>;

  for (const item of abi) {
    if (item.type === 'event') {
      const name = item.name as EventLogDecoder<TAbi>;
      eventLogDecoders[name] = createEventLogDecoder(name);
    }
  }

  return eventLogDecoders;
}
