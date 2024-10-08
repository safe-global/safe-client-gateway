import type { Hex } from 'viem';

export interface IEncoder<E = Hex> {
  encode(): E;
}
