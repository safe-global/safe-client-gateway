import { Hex } from 'viem/src/types/misc';

export enum ValueType {
  Text = 'text',
  TokenValue = 'tokenValue',
  Address = 'address',
  Number = 'number',
}

type TokenValue = {
  amount: bigint;
  address: string;
};

export interface TokenValueFragment {
  type: ValueType.TokenValue;
  value: TokenValue;
}

export interface TextFragment {
  type: ValueType.Text;
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
  | TextFragment
  | TokenValueFragment
  | AddressFragment
  | NumberFragment;

export type FunctionSignature = string;
export type FunctionSignatureHash = Hex;
