// SPDX-License-Identifier: FSL-1.1-MIT

import { randomBytes } from 'node:crypto';
import { faker } from '@faker-js/faker';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  canonicalContext,
} from '#/domain/common/utils/encryption';

describe('Encryption Utils', () => {
  describe('aesGcmEncrypt/aesGcmDecrypt', () => {
    const key = randomBytes(32);
    const aad = canonicalContext({ owner: faker.string.numeric() });

    it('should round-trip with the same key and AAD', () => {
      const plaintext = Buffer.from(faker.lorem.paragraph(), 'utf8');

      const { iv, ciphertext, tag } = aesGcmEncrypt({ plaintext, key, aad });

      expect(iv).toHaveLength(12);
      expect(tag).toHaveLength(16);
      expect(aesGcmDecrypt({ ciphertext, key, iv, tag, aad })).toStrictEqual(
        plaintext,
      );
    });

    it('should reject a wrong key', () => {
      const plaintext = Buffer.from(faker.lorem.sentence(), 'utf8');
      const { iv, ciphertext, tag } = aesGcmEncrypt({ plaintext, key, aad });

      expect(() =>
        aesGcmDecrypt({ ciphertext, key: randomBytes(32), iv, tag, aad }),
      ).toThrow();
    });

    it('should reject a mismatched AAD', () => {
      const plaintext = Buffer.from(faker.lorem.sentence(), 'utf8');
      const { iv, ciphertext, tag } = aesGcmEncrypt({ plaintext, key, aad });

      expect(() =>
        aesGcmDecrypt({
          ciphertext,
          key,
          iv,
          tag,
          aad: canonicalContext({ owner: faker.string.alpha(8) }),
        }),
      ).toThrow();
    });

    it('should reject a tampered ciphertext', () => {
      const plaintext = Buffer.from(faker.lorem.sentence(), 'utf8');
      const { iv, ciphertext, tag } = aesGcmEncrypt({ plaintext, key, aad });
      ciphertext[0] ^= 0xff;

      expect(() => aesGcmDecrypt({ ciphertext, key, iv, tag, aad })).toThrow();
    });
  });

  describe('canonicalContext', () => {
    it('should be insensitive to key insertion order', () => {
      expect(canonicalContext({ a: '1', b: '2' })).toStrictEqual(
        canonicalContext({ b: '2', a: '1' }),
      );
    });

    it('should differ when a value differs', () => {
      expect(canonicalContext({ a: '1' })).not.toStrictEqual(
        canonicalContext({ a: '2' }),
      );
    });
  });
});
