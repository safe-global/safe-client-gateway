import type { ValueTransformer } from 'typeorm';
import type { Address } from 'viem';
import { getAddress } from 'viem';

// TODO: add tests
export const databaseAddressTransformer: ValueTransformer = {
  to(value: string): Address {
    return getAddress(value);
  },
  from(value: string): Address {
    return getAddress(value);
  },
};
