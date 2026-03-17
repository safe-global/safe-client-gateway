// SPDX-License-Identifier: FSL-1.1-MIT

export const IEncryptionService = Symbol('IEncryptionService');

export interface EncryptedField {
  /** Raw base64-encoded ciphertext (no version prefix) */
  ciphertext: string;
  /** The encryption version used */
  version: number;
}

export interface IEncryptionService {
  /**
   * Encrypts a plaintext string using AES-256-GCM with the current version DEK.
   * Returns the ciphertext and the version used — the caller is responsible
   * for persisting the version in a separate column.
   *
   * @param plaintext - The string to encrypt
   * @returns The ciphertext and version number
   */
  encrypt(plaintext: string): EncryptedField;

  /**
   * Decrypts a ciphertext string using the DEK for the given version.
   * Throws if the version is unknown or the ciphertext is corrupt/tampered.
   *
   * @param ciphertext - The base64-encoded ciphertext
   * @param version - The encryption version (determines which DEK to use)
   * @returns The decrypted plaintext string
   */
  decrypt(ciphertext: string, version: number): string;

  /**
   * Computes a deterministic, non-reversible HMAC-SHA256 hash for queryable fields.
   * The input is lowercased before hashing to ensure case-insensitive matching.
   *
   * @param value - The value to hash
   * @returns A 64-character hex string
   */
  hmac(value: string): string;
}
