// SPDX-License-Identifier: FSL-1.1-MIT
import type { ValueTransformer } from 'typeorm';
import type { Address } from 'viem';
import { getAddress } from 'viem';

export const databaseAddressTransformer: ValueTransformer = {
  to(value: string): Address {
    return getAddress(value);
  },
  from(value: string): Address {
    return getAddress(value);
  },
};

export const databaseNullableAddressTransformer: ValueTransformer = {
  to(value: string | null): Address | null {
    if (value === null || value === undefined) return null;
    return getAddress(value);
  },
  from(value: string | null): Address | null {
    if (value === null || value === undefined) return null;
    return getAddress(value);
  },
};
