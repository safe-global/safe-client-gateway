import { Hex } from 'viem/src/types/misc';

export enum ValueType {
  Text = 'text',
  TokenValue = 'tokenValue',
  Address = 'address',
  Number = 'number',
}

export interface InfoFragment {
  type: ValueType;
  value: string | bigint | `0x${string}` | TokenValue;
}

type TokenValue = {
  amount: bigint;
  address: string;
};

export interface TokenValueFragment extends InfoFragment {
  type: ValueType.TokenValue;
  value: TokenValue;
}

export interface TextFragment extends InfoFragment {
  type: ValueType.Text;
  value: string;
}

export interface AddressFragment extends InfoFragment {
  type: ValueType.Address;
  value: `0x${string}`;
}

export interface NumberFragment extends InfoFragment {
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
