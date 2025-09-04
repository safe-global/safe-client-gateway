import type { ValueTransformer } from 'typeorm';
import type { Address } from 'viem';
import { getAddress } from 'viem';

export const nullableDatabaseAddressTransformer: ValueTransformer = {
  to(value: string | null | undefined): Address | null {
    return value === null || value === undefined ? null : getAddress(value);
  },
  from(value: string | null): Address | null {
    return value === null ? null : getAddress(value);
  },
};
