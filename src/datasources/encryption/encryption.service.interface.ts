// SPDX-License-Identifier: FSL-1.1-MIT
export const IFieldEncryptionService = Symbol('IFieldEncryptionService');

export interface IFieldEncryptionService {
  /**
   * Encrypts a plaintext string using AES-256-GCM.
   * Returns a versioned string: `v1:base64(iv || tag || ct)`.
   *
   * @param plaintext - The string to encrypt
   * @returns Versioned ciphertext string
   */
  encrypt(plaintext: string): string;

  /**
   * Decrypts a versioned ciphertext string back to plaintext.
   *
   * @param ciphertext - The `v1:base64(...)` string to decrypt
   * @returns The decrypted plaintext string
   */
  decrypt(ciphertext: string): string;

  /**
   * Computes a deterministic, non-reversible HMAC-SHA256 hash for queryable fields.
   * The input is lowercased before hashing to ensure case-insensitive matching.
   *
   * @param value - The value to hash
   * @returns A 64-character hex string
   */
  hmac(value: string): string;
}
