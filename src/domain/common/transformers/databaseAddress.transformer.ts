import type { ValueTransformer } from 'typeorm';
import { getAddress } from 'viem';

// TODO: add tests
export const databaseAddressTransformer: ValueTransformer = {
  to(value: string): `0x${string}` {
    return getAddress(value);
  },
  from(value: string): `0x${string}` {
    return getAddress(value);
  },
};
