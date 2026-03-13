// SPDX-License-Identifier: FSL-1.1-MIT
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'crypto';
import type {
  EncryptedField,
  IEncryptionService,
} from '@/datasources/encryption/encryption.service.interface';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const DEK_LENGTH = 32;

/**
 * Synchronous field-level encryption service using AES-256-GCM.
 *
 * Supports multiple DEK versions for key rotation. Encrypts with the current
 * version; decrypts with whichever version the ciphertext was created under.
 * The version is NOT embedded in the ciphertext — callers must persist it
 * in a separate `encryption_version` column.
 */
export class EncryptionService implements IEncryptionService {
  readonly currentVersion: number;

  constructor(
    private readonly dekVersions: ReadonlyMap<number, Buffer>,
    currentVersion: number,
    private readonly hmacKey: Buffer,
  ) {
    if (dekVersions.size === 0) {
      throw new Error('At least one DEK version must be provided');
    }

    for (const [version, dek] of dekVersions) {
      if (dek.length !== DEK_LENGTH) {
        throw new Error(
          `DEK for version ${version} must be ${DEK_LENGTH} bytes, got ${dek.length}`,
        );
      }
    }

    if (!dekVersions.has(currentVersion)) {
      throw new Error(
        `Current version ${currentVersion} not found in DEK versions [${[...dekVersions.keys()].join(', ')}]`,
      );
    }

    this.currentVersion = currentVersion;
  }

  encrypt(plaintext: string): EncryptedField {
    const dek = this.dekVersions.get(this.currentVersion)!;
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, dek, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const payload = Buffer.concat([iv, tag, encrypted]);
    return {
      ciphertext: payload.toString('base64'),
      version: this.currentVersion,
    };
  }

  decrypt(ciphertext: string, version: number): string {
    const dek = this.dekVersions.get(version);
    if (!dek) {
      throw new Error(
        `No DEK found for encryption version ${version}. Available versions: [${[...this.dekVersions.keys()].join(', ')}]`,
      );
    }

    const payload = Buffer.from(ciphertext, 'base64');
    const minLength = IV_LENGTH + AUTH_TAG_LENGTH;
    if (payload.length < minLength) {
      throw new Error(
        `Ciphertext too short: expected at least ${minLength} bytes, got ${payload.length}`,
      );
    }

    const iv = payload.subarray(0, IV_LENGTH);
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ct = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, dek, iv, {
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
