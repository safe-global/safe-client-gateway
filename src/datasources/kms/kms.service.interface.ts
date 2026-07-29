// SPDX-License-Identifier: FSL-1.1-MIT

export const IKmsService = Symbol('IKmsService');

export interface IKmsService {
  encrypt(args: {
    plaintext: Buffer;
    encryptionContext?: Record<string, string>;
  }): Promise<Buffer>;

  /** Reverse of {@link encrypt}: decrypts a raw KMS ciphertext blob. */
  decrypt(args: {
    ciphertext: Buffer;
    encryptionContext?: Record<string, string>;
  }): Promise<Buffer>;

  /**
   * Generates a fresh AES-256 data key under the configured KMS key:
   * `plaintextKey` for immediate local use, `wrappedKey` (bound to
   * `encryptionContext`, unwrappable via {@link decrypt}) for storage.
   */
  generateDataKey(args: {
    encryptionContext?: Record<string, string>;
  }): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }>;
}
