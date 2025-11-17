import { singletonBuilder } from '@/modules/chains/domain/entities/__tests__/singleton.builder';
import { SingletonSchema } from '@/modules/chains/domain/entities/schemas/singleton.schema';
import type { Singleton } from '@/modules/chains/domain/entities/singleton.entity';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

describe('SingletonSchema', () => {
  it('should validate a singleton', () => {
    const singleton = singletonBuilder().build();

    const result = SingletonSchema.safeParse(singleton);

    expect(result.success).toBe(true);
  });

  it.each(['address' as const])('should checksum %s', (key) => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
    const singleton = singletonBuilder()
      .with(key, nonChecksummedAddress)
      .build();

    const result = SingletonSchema.safeParse(singleton);

    expect(result.success && result.data[key]).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each<keyof Singleton>([
    'address',
    'version',
    'deployer',
    'deployedBlockNumber',
    'lastIndexedBlockNumber',
    'l2',
  ])('should not allow %s to be undefined', (key) => {
    const singleton = singletonBuilder().build();
    delete singleton[key];

    const result = SingletonSchema.safeParse(singleton);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === key,
    ).toBe(true);
  });
});
