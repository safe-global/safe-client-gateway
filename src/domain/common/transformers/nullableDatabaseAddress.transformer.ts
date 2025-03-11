import type { ValueTransformer } from 'typeorm';
import { getAddress } from 'viem';

export const nullableDatabaseAddressTransformer: ValueTransformer = {
  to(value: string | null | undefined): `0x${string}` | null {
    return value === null || value === undefined ? null : getAddress(value);
  },
  from(value: string | null): `0x${string}` | null {
    return value === null ? null : getAddress(value);
  },
};
