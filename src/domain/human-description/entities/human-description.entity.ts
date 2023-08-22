import { Abi } from 'viem';
import { Hex } from 'viem/src/types/misc';

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

type SignatureHash = Hex;
type FunctionSignature = string;
type HumanDescription = string;

type HumanDescriptionTemplate = {
  abi: Abi;
  process: (
    to: string,
    params: readonly unknown[],
  ) => HumanDescriptionFragment[];
};

export type HumanDescriptionTemplates = Record<
  SignatureHash,
  HumanDescriptionTemplate
>;

export type HumanDescriptions = Record<FunctionSignature, HumanDescription>;
