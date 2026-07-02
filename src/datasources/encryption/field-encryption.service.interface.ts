// SPDX-License-Identifier: FSL-1.1-MIT

export const IFieldEncryptionService = Symbol('IFieldEncryptionService');

/**
 * Keyholder for the app-wide blind-index key: AWS KMS protects the configured
 * data keys, which are unwrapped once at boot and used to compute blind
 * indexes for searchable/unique encrypted fields (e.g. email).
 */
export interface IFieldEncryptionService {
  /**
   * Deterministic keyed HMAC (base64url) over the normalised input, used as a
   * blind index for searchable/unique fields (e.g. email). Computable from the
   * plaintext alone; keyed by the configured index key, which is separate from
   * the per-entity encryption data keys.
   */
  blindIndex(plaintext: string): string;
}
