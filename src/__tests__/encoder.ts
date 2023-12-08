import { Hex } from 'viem';

import { Builder, IBuilder } from '@/__tests__/builder';

export interface IEncoder<T, E = Hex> extends IBuilder<T> {
  encode(): E;
}

export class Encoder<T, E = Hex> extends Builder<T> implements IEncoder<T, E> {
  encode(): E {
    throw new Error('Method not implemented.');
  }

  public static new<T, E = Hex>() {
    return new this<T, E>({});
  }
}
