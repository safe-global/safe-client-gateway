// SPDX-License-Identifier: FSL-1.1-MIT

import type { ValueTransformer } from 'typeorm';
import { FieldEncryptionRegistry } from '@/datasources/encryption/field-encryption.registry';

/**
 * Builds a TypeORM column transformer that transparently encrypts on write and
 * decrypts on read using the registered {@link IFieldEncryptionService}.
 *
 * `aad` binds the ciphertext to this specific field (see FieldEncryptionAad).
 *
 * Set `deterministic` for unique/searchable columns (e.g. email) so equality
 * lookups and unique constraints keep working; see
 * {@link IFieldEncryptionService.encryptDeterministic}.
 *
 * `null`/`undefined` pass through untouched (note: TypeORM invokes `to` even for
 * these). When no service is registered, values pass through unchanged so that
 * contexts which do not wire encryption (e.g. some integration tests) behave as
 * plain `text` columns.
 */
export function fieldEncryptionTransformer(
  aad: string,
  options?: { deterministic?: boolean },
): ValueTransformer {
  const deterministic = options?.deterministic ?? false;
  return {
    to(value: string | null | undefined): string | null | undefined {
      if (value === null || value === undefined) {
        return value;
      }
      const service = FieldEncryptionRegistry.get();
      if (!service) {
        return value;
      }
      return deterministic
        ? service.encryptDeterministic(value, aad)
        : service.encrypt(value, aad);
    },
    from(value: string | null | undefined): string | null | undefined {
      if (value === null || value === undefined) {
        return value;
      }
      const service = FieldEncryptionRegistry.get();
      return service ? service.decrypt(value, aad) : value;
    },
  };
}
