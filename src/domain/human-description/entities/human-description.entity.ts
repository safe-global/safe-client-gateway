export enum ValueType {
  Word = 'word',
  TokenValue = 'tokenValue',
  Address = 'address',
  Decimals = 'decimals',
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

export interface DecimalsFragment {
  type: ValueType.Decimals;
  value: unknown;
}

export type HumanDescriptionFragment =
  | WordFragment
  | TokenValueFragment
  | AddressFragment
  | DecimalsFragment;

export type FunctionSignature = string;
