// SPDX-License-Identifier: FSL-1.1-MIT

/*
 * On-disk contract — immutable once ciphertext or indexes exist:
 * - the `kms:v1:` prefix,
 * - the encryption-context shape ({ userId | spaceId, field }),
 * - the blind-index HMAC construction (domain label, `\0` separators,
 *   field segment, trim+lowercase normalisation, base64url).
 * Changing any of these makes stored values undecryptable or unmatchable.
 * users.email predates the field segment and keeps the un-segmented
 * construction — see FieldCryptoService.emailBlindIndex.
 */

/** Prefix marking a stored value as KMS ciphertext (`kms:v1:<base64url>`). */
export const FIELD_ENCRYPTION_PREFIX = 'kms';

/** Version segment of the stored-ciphertext format. */
export const FIELD_ENCRYPTION_VERSION = 'v1';

/** Domain-separation label of the blind-index HMAC. */
export const BLIND_INDEX_LABEL = 'fieldenc-blind-index-v1';

/** Required length (bytes) of the unwrapped blind-index key. */
export const INDEX_KEY_LENGTH = 32;

/** Upper bound of the in-process decrypt cache. */
export const DECRYPT_CACHE_MAX_ENTRIES = 10_000;

/**
 * Decrypt-cache TTL. Also bounds how long a cached plaintext survives after
 * KMS access is revoked or the key is scheduled for destruction.
 */
export const DECRYPT_CACHE_TTL_MS = 5 * 60 * 1_000;

/**
 * Every encrypted column, as `<table>.<column>`. The field id is bound into
 * the KMS encryption context and the blind-index HMAC, so a ciphertext or
 * index token from one column can never be replayed against another.
 */
export const ENCRYPTED_FIELDS = [
  'users.email',
  'wallets.address',
  'spaces.name',
  'space_safes.address',
  'space_address_book_items.address',
  'space_address_book_items.name',
  'address_book_requests.address',
  'address_book_requests.name',
  'members.name',
  'members.alias',
] as const;
export type EncryptedField = (typeof ENCRYPTED_FIELDS)[number];

/**
 * The encryption-context owner of a value: the user for user-owned fields,
 * the space for space-owned fields — never both, never a row id, so the
 * identical context is reconstructible anywhere the owner is known (this is
 * what lets audit-log payloads reuse source-row ciphertext).
 */
export type FieldScope = { userId: number } | { spaceId: number };
