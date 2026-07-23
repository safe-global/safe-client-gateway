// SPDX-License-Identifier: FSL-1.1-MIT

/** Prefix marking a stored value as KMS-envelope ciphertext (`kms:v1:<base64url>`). */
export const ENCRYPTION_PREFIX = 'kms';

/**
 * Version segment of the stored-ciphertext format. v1 is envelope
 * encryption: the base64url blob packs a KMS-wrapped per-value data key and
 * the value encrypted locally with AES-256-GCM under that key. KMS never
 * sees the value itself, so no KMS plaintext-size limit applies (the
 * Encrypt API would cap direct encryption at 4096 bytes — audit payloads
 * can exceed that).
 */
export const ENCRYPTION_VERSION = 'v1';

/** Envelope blob layout: u16BE wrapped-key length, then wrapped key, IV, ciphertext, GCM tag. */
export const ENVELOPE_KEY_LENGTH_BYTES = 2;
export const ENVELOPE_IV_BYTES = 12;
export const ENVELOPE_TAG_BYTES = 16;

/** Domain-separation label of the blind-index HMAC. */
export const BLIND_INDEX_LABEL = 'blind-index-v1';

/** Required length (bytes) of the unwrapped blind-index key. */
export const INDEX_KEY_LENGTH = 32;
