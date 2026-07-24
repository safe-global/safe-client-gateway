// SPDX-License-Identifier: FSL-1.1-MIT
import type { ValueTransformer } from 'typeorm';
import { getAddress } from 'viem';

/**
 * Encrypted address columns hold `kms:v1:…` ciphertext (see
 * `@/datasources/kms/encryption.constants`); checksumming would corrupt it,
 * so ciphertext passes through untouched. The plaintext (EIP-55 checksummed)
 * form is what gets encrypted, and decryption restores it — plaintext-mode
 * behavior is byte-identical to the pre-encryption transformer.
 *
 * The return type is `string`, not `Address`: ciphertext is not a valid
 * checksummed address, so annotating it `Address` would be a lie. The entity
 * columns still declare their own `Address` type for the decrypted value.
 */
const isCiphertext = (value: string): boolean => value.startsWith('kms:');

export const databaseAddressTransformer: ValueTransformer = {
  to(value: string): string {
    return isCiphertext(value) ? value : getAddress(value);
  },
  from(value: string): string {
    return isCiphertext(value) ? value : getAddress(value);
  },
};

export const databaseNullableAddressTransformer: ValueTransformer = {
  to(value: string | null): string | null {
    if (value === null || value === undefined) return null;
    return isCiphertext(value) ? value : getAddress(value);
  },
  from(value: string | null): string | null {
    if (value === null || value === undefined) return null;
    return isCiphertext(value) ? value : getAddress(value);
  },
};
