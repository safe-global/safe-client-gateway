export enum ValueType {
  Word = 'word',
  TokenValue = 'tokenValue',
  Identifier = 'identifier',
  Address = 'address',
  Decimals = 'decimals',
}

type TokenValueType = {
  amount: bigint;
  address: string;
};

interface TokenValueFragment {
  type: ValueType.TokenValue;
  value: TokenValueType;
}

interface WordFragment {
  type: ValueType.Word;
  value: string;
}

interface IdentifierFragment {
  type: ValueType.Identifier;
  value: unknown;
}

interface AddressFragment {
  type: ValueType.Address;
  value: string;
}

interface DecimalsFragment {
  type: ValueType.Decimals;
  value: unknown;
}

export type HumanReadableFragment =
  | WordFragment
  | TokenValueFragment
  | IdentifierFragment
  | AddressFragment
  | DecimalsFragment;

type MessageTemplate = {
  process: (to: string, params: readonly unknown[]) => HumanReadableFragment[];
};

export type MessageTemplates = Record<string, MessageTemplate>;

export type Expression = {
  [key: string]: string;
};
