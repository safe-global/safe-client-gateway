export enum ValueType {
  Word = 'word',
  TokenValue = 'tokenValue',
  Address = 'address',
  Number = 'number',
}

export interface TokenValueFragment {
  type: ValueType.TokenValue;
  value: {
    amount: bigint;
    address: string;
  };
}

export interface WordFragment {
  type: ValueType.Word;
  value: string;
}

export interface AddressFragment {
  type: ValueType.Address;
  value: `0x${string}`;
}

export interface NumberFragment {
  type: ValueType.Number;
  value: bigint;
}

export type HumanDescriptionFragment =
  | WordFragment
  | TokenValueFragment
  | AddressFragment
  | NumberFragment;

export type FunctionSignature = string;
