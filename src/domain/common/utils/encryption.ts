// SPDX-License-Identifier: FSL-1.1-MIT
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

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
  /** IV length in bytes; defaults to 12, the GCM standard. */
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
