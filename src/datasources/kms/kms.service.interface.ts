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
}
