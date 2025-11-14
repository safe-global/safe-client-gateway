import type { Hex } from 'viem/types/misc';
import type { Address } from 'viem';

export enum ValueType {
  Text = 'text',
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

export interface TextFragment {
  type: ValueType.Text;
  value: string;
}

export interface AddressFragment {
  type: ValueType.Address;
  value: Address;
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
