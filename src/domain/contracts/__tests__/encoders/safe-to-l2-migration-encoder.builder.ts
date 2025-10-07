import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { encodeFunctionData, getAddress } from 'viem';
import SafeToL2Migration from '@/abis/safe/v1.4.1/SafeToL2Migration.abi';
import type { IEncoder } from '@/__tests__/encoder-builder';
import { Builder } from '@/__tests__/builder';

// migrateToL2

type MigrateToL2Args = {
  l2Singleton: Hex;
};

class MigrateToL2Encoder<T extends MigrateToL2Args>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: SafeToL2Migration,
      functionName: 'migrateToL2',
      args: [args.l2Singleton],
    });
  }
}

export function migrateToL2Encoder(): MigrateToL2Encoder<MigrateToL2Args> {
  return new MigrateToL2Encoder().with(
    'l2Singleton',
    getAddress(faker.finance.ethereumAddress()),
  );
}
