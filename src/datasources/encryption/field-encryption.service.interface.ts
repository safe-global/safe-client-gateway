// SPDX-License-Identifier: FSL-1.1-MIT

export const IFieldEncryptionService = Symbol('IFieldEncryptionService');

/**
 * Field-level encryption of human-entered labels using envelope encryption:
 * AWS KMS protects the data keys, and this service performs local AES-256-GCM
 * encryption with them.
 *
 * Ciphertext is versioned and self-identifying:
 *   `enc:v1:<keyId>:<base64url(iv)>:<base64url(tag)>:<base64url(ciphertext)>`
 *
 * The embedded `keyId` lets reads pick the right data key, enabling key rotation
 * without re-encrypting existing rows.
 */
export interface IFieldEncryptionService {
  /**
   * Encrypts a plaintext value. When encryption is disabled, returns the
   * plaintext unchanged (no-op), so callers can wire this in unconditionally.
   *
   * @param plaintext - The value to encrypt.
   * @param aad - Optional additional authenticated data binding the ciphertext
   *   to a context (e.g. a logical field name). Must be supplied identically at
   *   decryption time.
   */
  encrypt(plaintext: string, aad?: string): string;

  /**
   * Like {@link encrypt} but deterministic: identical (plaintext, aad) always
   * produce identical ciphertext (the IV is derived from the plaintext rather
   * than random). This preserves equality lookups and unique constraints, at
   * the cost of revealing which values are equal — appropriate for unique,
   * searchable fields such as an email address. Output is decryptable via
   * {@link decrypt}.
   */
  encryptDeterministic(plaintext: string, aad?: string): string;

  /**
   * Decrypts a value produced by {@link encrypt}. Values that are not in the
   * `enc:` ciphertext format are treated as legacy plaintext and returned
   * as-is only while legacy plaintext reads are allowed; otherwise it throws.
   *
   * @param value - The stored value (ciphertext or legacy plaintext).
   * @param aad - The same additional authenticated data used at encryption time.
   */
  decrypt(value: string, aad?: string): string;

  /**
   * Whether `value` is in the `enc:` ciphertext format produced by this service.
   */
  isEncrypted(value: string): boolean;

  /**
   * Deterministic keyed HMAC (base64url) over the normalised input, used as a
   * blind index for searchable/unique fields (e.g. email). Computable from the
   * plaintext alone; keyed by the configured index key, which is separate from
   * the encryption data keys.
   */
  blindIndex(plaintext: string): string;
}
