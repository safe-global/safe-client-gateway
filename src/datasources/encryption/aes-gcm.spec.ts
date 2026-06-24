// SPDX-License-Identifier: FSL-1.1-MIT
import { randomBytes } from 'node:crypto';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  formatCiphertext,
  parseCiphertext,
} from '@/datasources/encryption/aes-gcm';

describe('aes-gcm', () => {
  const key = randomBytes(32);

  it('round-trips with AAD', () => {
    const parts = aesGcmEncrypt(key, Buffer.from('hello'), 'aad');
    expect(aesGcmDecrypt(key, parts, 'aad').toString()).toBe('hello');
  });

  it('round-trips without AAD', () => {
    const parts = aesGcmEncrypt(key, Buffer.from('hello'));
    expect(aesGcmDecrypt(key, parts).toString()).toBe('hello');
  });

  it('fails the auth check on AAD mismatch', () => {
    const parts = aesGcmEncrypt(key, Buffer.from('hello'), 'aad');
    expect(() => aesGcmDecrypt(key, parts, 'other')).toThrow();
  });

  it('uses a random IV by default (distinct ciphertext for equal input)', () => {
    const a = aesGcmEncrypt(key, Buffer.from('same'));
    const b = aesGcmEncrypt(key, Buffer.from('same'));
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it('honours an explicit IV', () => {
    const iv = randomBytes(12);
    const a = aesGcmEncrypt(key, Buffer.from('x'), undefined, iv);
    expect(a.iv.equals(iv)).toBe(true);
  });

  it('formats and parses a versioned ciphertext string', () => {
    const parts = aesGcmEncrypt(key, Buffer.from('x'));
    const str = formatCiphertext('enc', 'v2', 'space-7', parts);
    expect(str.startsWith('enc:v2:space-7:')).toBe(true);

    const parsed = parseCiphertext(str);
    expect(parsed.prefix).toBe('enc');
    expect(parsed.version).toBe('v2');
    expect(parsed.keyId).toBe('space-7');
    expect(aesGcmDecrypt(key, parsed).toString()).toBe('x');
  });

  it('rejects a malformed ciphertext string', () => {
    expect(() => parseCiphertext('enc:v2:too:few')).toThrow(
      'Malformed ciphertext',
    );
  });
});
