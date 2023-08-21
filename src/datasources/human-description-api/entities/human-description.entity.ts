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
  value: `0x${string}`;
}

interface DecimalsFragment {
  type: ValueType.Decimals;
  value: unknown;
}

export type HumanDescriptionFragment =
  | WordFragment
  | TokenValueFragment
  | IdentifierFragment
  | AddressFragment
  | DecimalsFragment;

type HumanDescriptionTemplate = {
  process: (
    to: string,
    params: readonly unknown[],
  ) => HumanDescriptionFragment[];
};

export type HumanDescriptionTemplates = Record<
  string,
  HumanDescriptionTemplate
>;

export type Expression = Record<string, string>;
