import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const derivedKeyCache = new Map<string, Buffer>();

function getDerivedKey(encryptionKey: string, salt: string): Buffer {
  const cacheKey = `${encryptionKey}:${salt}`;
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const derived = scryptSync(encryptionKey, Buffer.from(salt, 'utf8'), 32);
  derivedKeyCache.set(cacheKey, derived);

  return derived;
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
  if (!encryptionKey || !salt) {
    throw new Error('Encryption key and salt are required');
  }

  try {
    const key = getDerivedKey(encryptionKey, salt);
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const dataString = JSON.stringify(data);
    const encrypted = Buffer.concat([
      cipher.update(dataString, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
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
  if (!encryptionKey || !encryptedData || !salt) {
    throw new Error('Decryption data and configuration are required');
  }

  try {
    const key = getDerivedKey(encryptionKey, salt);
    const buffer = Buffer.from(encryptedData, 'base64');
    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(16, 32);
    const encrypted = buffer.subarray(32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    throw new Error(
      `Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
