// SPDX-License-Identifier: FSL-1.1-MIT

/*
 * On-disk contract — immutable once ciphertext or indexes exist:
 * - the `kms:v1:` prefix,
 * - the blind-index HMAC construction (domain label, `\0` separators, caller
 *   label segment, trim+lowercase normalisation, base64url).
 * Changing any of these makes stored values undecryptable or unmatchable.
 */

/** Prefix marking a stored value as KMS ciphertext (`kms:v1:<base64url>`). */
export const ENCRYPTION_PREFIX = 'kms';

/** Version segment of the stored-ciphertext format. */
export const ENCRYPTION_VERSION = 'v1';

/** Domain-separation label of the blind-index HMAC. */
export const BLIND_INDEX_LABEL = 'blind-index-v1';

/** Required length (bytes) of the unwrapped blind-index key. */
export const INDEX_KEY_LENGTH = 32;
