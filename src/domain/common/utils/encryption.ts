// SPDX-License-Identifier: FSL-1.1-MIT
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

/**
 * Low-level AES-256-GCM encryption over a caller-supplied raw 32-byte key,
 * with optional additional authenticated data (AAD). The key is used as
 * given (no derivation); callers own the storage framing of the returned
 * pieces. A fresh random IV is generated per call.
 */
export function aesGcmEncrypt(args: {
  plaintext: Buffer;
  key: Buffer;
  aad?: Buffer;
  /** IV length in bytes; 12 is the GCM standard. `encryptData` predates it with 16. */
  ivLength?: number;
}): { iv: Buffer; ciphertext: Buffer; tag: Buffer } {
  const iv = randomBytes(args.ivLength ?? 12);
  const cipher = createCipheriv('aes-256-gcm', args.key, iv);
  if (args.aad) {
    cipher.setAAD(args.aad);
  }
  const ciphertext = Buffer.concat([
    cipher.update(args.plaintext),
    cipher.final(),
  ]);
  return { iv, ciphertext, tag: cipher.getAuthTag() };
}

/**
 * Reverse of {@link aesGcmEncrypt}. Throws when authentication fails —
 * i.e. on a tampered ciphertext/tag or a mismatched key or AAD.
 */
export function aesGcmDecrypt(args: {
  ciphertext: Buffer;
  key: Buffer;
  iv: Buffer;
  tag: Buffer;
  aad?: Buffer;
}): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', args.key, args.iv);
  if (args.aad) {
    decipher.setAAD(args.aad);
  }
  decipher.setAuthTag(args.tag);
  return Buffer.concat([decipher.update(args.ciphertext), decipher.final()]);
}

/**
 * Stable byte serialisation of a string-to-string context map (entries
 * sorted by key, JSON encoded), for binding a context as GCM AAD.
 */
export function canonicalContext(context: Record<string, string>): Buffer {
  const entries = Object.entries(context).sort(([a], [b]) => {
    if (a < b) {
      return -1;
    }
    return a > b ? 1 : 0;
  });
  return Buffer.from(JSON.stringify(entries), 'utf8');
}

/**
 * Encrypts data using AES-256-GCM encryption.
 *
 * @param data - Data to encrypt (will be JSON stringified)
 * @param encryptionKey - Encryption key (will be derived using scrypt)
 * @param salt - Salt for key derivation
 *
 * @returns Base64 encoded encrypted data in format: iv:authTag:encryptedData
 * @throws Error if encryption key is invalid or encryption fails
 */
export function encryptData<T>(
  data: T,
  encryptionKey: string,
  salt: string,
): string {
  if (!(encryptionKey && salt)) {
    throw new Error('Encryption key and salt are required');
  }

  try {
    const saltBuffer = Buffer.from(salt, 'utf8');
    const key = scryptSync(encryptionKey, saltBuffer, 32);
    const { iv, ciphertext, tag } = aesGcmEncrypt({
      plaintext: Buffer.from(JSON.stringify(data), 'utf8'),
      key,
      ivLength: 16,
    });
    return Buffer.concat([iv, tag, ciphertext]).toString('base64');
  } catch (error) {
    throw new Error(
      `Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Decrypts data using AES-256-GCM decryption.
 *
 * @param encryptedData - Base64 encoded encrypted data in format: iv:authTag:encryptedData
 * @param encryptionKey - Encryption key (will be derived using scrypt)
 * @param salt - Salt for key derivation (optional, defaults to 'safe-encryption-salt')
 *
 * @returns Decrypted data
 * @throws Error if decryption key is invalid, data is corrupted, or decryption fails
 */
export function decryptData<T>(
  encryptedData: string,
  encryptionKey: string,
  salt: string,
): T {
  if (!(encryptionKey && encryptedData && salt)) {
    throw new Error('Decryption data and configuration are required');
  }

  try {
    const saltBuffer = Buffer.from(salt, 'utf8');
    const key = scryptSync(encryptionKey, saltBuffer, 32);
    const buffer = Buffer.from(encryptedData, 'base64');
    const decrypted = aesGcmDecrypt({
      ciphertext: buffer.subarray(32),
      key,
      iv: buffer.subarray(0, 16),
      tag: buffer.subarray(16, 32),
    });

    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    throw new Error(
      `Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
