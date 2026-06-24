// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * A symmetric data key produced by a KMS `GenerateDataKey` operation.
 *
 * `plaintext` is the raw key material used locally for AES encryption. It must
 * NEVER be persisted or logged. `encrypted` is the KMS-wrapped form that is safe
 * to store in configuration and can later be unwrapped via {@link IKmsApi.decrypt}.
 */
export interface KmsDataKey {
  plaintext: Buffer;
  encrypted: Buffer;
}

export const IKmsApi = Symbol('IKmsApi');

export interface IKmsApi {
  /**
   * Generates a new 256-bit symmetric data key wrapped by the configured KMS key.
   *
   * Used by the data-key helper script to bootstrap envelope encryption. The
   * returned {@link KmsDataKey.encrypted} blob is what gets stored in config; the
   * plaintext is discarded after use.
   */
  generateDataKey(): Promise<KmsDataKey>;

  /**
   * Wraps arbitrary key material with the configured KMS key. The
   * `encryptionContext` is bound into the ciphertext and MUST be supplied
   * identically to {@link decrypt}, or the unwrap fails. Used to mint per-entity
   * data keys bound to their owning entity (e.g. `{ spaceId }`, `{ userId }`).
   *
   * @param plaintext - The raw key material to wrap.
   * @param encryptionContext - Non-secret key/value pairs bound into the ciphertext.
   */
  encrypt(
    plaintext: Buffer,
    encryptionContext: Record<string, string>,
  ): Promise<Buffer>;

  /**
   * Unwraps a KMS-encrypted data key, returning the raw key material.
   *
   * @param encrypted - The KMS ciphertext blob produced by {@link generateDataKey}
   *   or {@link encrypt}.
   * @param encryptionContext - The same context supplied to {@link encrypt}, if any.
   */
  decrypt(
    encrypted: Buffer,
    encryptionContext?: Record<string, string>,
  ): Promise<Buffer>;
}
