import { Hex } from 'viem';

import { Builder, IBuilder } from '@/__tests__/builder';

export interface IEncoderBuilder<T, E = Hex> extends IBuilder<T> {
  encode(): E;
}

export class EncoderBuilder<T, E = Hex>
  extends Builder<T>
  implements IEncoderBuilder<T, E>
{
  encode(): E {
    throw new Error('Method not implemented.');
  }

  public static new<T, E = Hex>() {
    return new this<T, E>({});
  }
}
