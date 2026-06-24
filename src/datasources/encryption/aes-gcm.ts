// SPDX-License-Identifier: FSL-1.1-MIT
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const ALGORITHM = 'aes-256-gcm';
// 96-bit nonce is the recommended size for AES-GCM.
export const IV_LENGTH = 12;
export const KEY_LENGTH = 32;

export interface AesGcmParts {
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
}

/**
 * AES-256-GCM encryption of `plaintext` under `key`, optionally bound to `aad`.
 * `iv` is overridable for deterministic callers; it defaults to a random nonce.
 */
export function aesGcmEncrypt(
  key: Buffer,
  plaintext: Buffer,
  aad?: string,
  iv: Buffer = randomBytes(IV_LENGTH),
): AesGcmParts {
  const cipher = createCipheriv(ALGORITHM, key, iv);
  if (aad !== undefined) {
    cipher.setAAD(Buffer.from(aad, 'utf8'));
  }
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}

/** Reverse of {@link aesGcmEncrypt}. Throws if the auth tag or AAD do not match. */
export function aesGcmDecrypt(
  key: Buffer,
  parts: AesGcmParts,
  aad?: string,
): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, parts.iv);
  decipher.setAuthTag(parts.tag);
  if (aad !== undefined) {
    decipher.setAAD(Buffer.from(aad, 'utf8'));
  }
  return Buffer.concat([decipher.update(parts.ciphertext), decipher.final()]);
}

/**
 * Serialises encrypted parts into the self-describing on-disk form
 * `<prefix>:<version>:<keyId>:<base64url iv>:<base64url tag>:<base64url ct>`.
 */
export function formatCiphertext(
  prefix: string,
  version: string,
  keyId: string,
  parts: AesGcmParts,
): string {
  return [
    prefix,
    version,
    keyId,
    parts.iv.toString('base64url'),
    parts.tag.toString('base64url'),
    parts.ciphertext.toString('base64url'),
  ].join(':');
}

export interface ParsedCiphertext extends AesGcmParts {
  prefix: string;
  version: string;
  keyId: string;
}

/** Reverse of {@link formatCiphertext}. */
export function parseCiphertext(value: string): ParsedCiphertext {
  const parts = value.split(':');
  if (parts.length !== 6) {
    throw new Error('Malformed ciphertext');
  }
  const [prefix, version, keyId, iv, tag, ciphertext] = parts;
  return {
    prefix,
    version,
    keyId,
    iv: Buffer.from(iv, 'base64url'),
    tag: Buffer.from(tag, 'base64url'),
    ciphertext: Buffer.from(ciphertext, 'base64url'),
  };
}
