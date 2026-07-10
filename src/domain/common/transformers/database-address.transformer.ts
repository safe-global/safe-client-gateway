// SPDX-License-Identifier: FSL-1.1-MIT
import type { ValueTransformer } from 'typeorm';
import type { Address } from 'viem';
import { getAddress } from 'viem';

/**
 * Encrypted address columns hold `kms:v1:…` ciphertext (see
 * `@/datasources/kms/field-crypto.constants`); checksumming would corrupt it,
 * so ciphertext passes through untouched. The plaintext (EIP-55 checksummed)
 * form is what gets encrypted, and decryption restores it — plaintext-mode
 * behavior is byte-identical to the pre-encryption transformer.
 */
const isCiphertext = (value: string): boolean => value.startsWith('kms:');

export const databaseAddressTransformer: ValueTransformer = {
  to(value: string): Address {
    return isCiphertext(value) ? (value as Address) : getAddress(value);
  },
  from(value: string): Address {
    return isCiphertext(value) ? (value as Address) : getAddress(value);
  },
};

export const databaseNullableAddressTransformer: ValueTransformer = {
  to(value: string | null): Address | null {
    if (value === null || value === undefined) return null;
    return isCiphertext(value) ? (value as Address) : getAddress(value);
  },
  from(value: string | null): Address | null {
    if (value === null || value === undefined) return null;
    return isCiphertext(value) ? (value as Address) : getAddress(value);
  },
};
