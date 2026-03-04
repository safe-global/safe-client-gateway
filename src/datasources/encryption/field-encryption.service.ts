// SPDX-License-Identifier: FSL-1.1-MIT
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'crypto';
import type { IFieldEncryptionService } from '@/datasources/encryption/encryption.service.interface';

const VERSION_PREFIX = 'v1:';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Synchronous field-level encryption service using AES-256-GCM.
 *
 * DEK and HMAC key are injected at construction time (decrypted once at startup).
 * All operations are synchronous — no KMS calls per operation.
 */
export class FieldEncryptionService implements IFieldEncryptionService {
  constructor(
    private readonly dek: Buffer,
    private readonly hmacKey: Buffer,
  ) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.dek, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const payload = Buffer.concat([iv, tag, encrypted]);
    return VERSION_PREFIX + payload.toString('base64');
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext.startsWith(VERSION_PREFIX)) {
      throw new Error(
        `Unsupported ciphertext format: expected '${VERSION_PREFIX}' prefix`,
      );
    }

    const payload = Buffer.from(
      ciphertext.slice(VERSION_PREFIX.length),
      'base64',
    );
    const iv = payload.subarray(0, IV_LENGTH);
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ct = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv('aes-256-gcm', this.dek, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
      'utf8',
    );
  }

  hmac(value: string): string {
    return createHmac('sha256', this.hmacKey)
      .update(value.toLowerCase())
      .digest('hex');
  }
}
