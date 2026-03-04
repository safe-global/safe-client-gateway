// SPDX-License-Identifier: FSL-1.1-MIT
import { FieldEncryptionService } from '@/datasources/encryption/field-encryption.service';
import { faker } from '@faker-js/faker/.';
import { randomBytes } from 'crypto';

const dek = randomBytes(32);
const hmacKey = randomBytes(32);

describe('FieldEncryptionService', () => {
  let service: FieldEncryptionService;

  beforeEach(() => {
    service = new FieldEncryptionService(dek, hmacKey);
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should encrypt and decrypt a string', () => {
      const plaintext = faker.person.fullName();

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce v1: prefixed output', () => {
      const encrypted = service.encrypt('test');

      expect(encrypted).toMatch(/^v1:/);
    });

    it('should produce different ciphertexts for the same plaintext', () => {
      const plaintext = faker.person.fullName();

      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty strings', () => {
      const encrypted = service.encrypt('');
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Ünïcödé 🎉 テスト';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw on invalid ciphertext format', () => {
      expect(() => service.decrypt('invalid-ciphertext')).toThrow(
        "Unsupported ciphertext format: expected 'v1:' prefix",
      );
    });
  });

  describe('hmac', () => {
    it('should produce a deterministic 64-char hex string', () => {
      const value = faker.finance.ethereumAddress();

      const hash1 = service.hmac(value);
      const hash2 = service.hmac(value);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be case-insensitive', () => {
      const value = '0xAbCdEf1234567890';

      expect(service.hmac(value.toUpperCase())).toBe(
        service.hmac(value.toLowerCase()),
      );
    });

    it('should produce different hashes for different values', () => {
      const hash1 = service.hmac('value1');
      const hash2 = service.hmac('value2');

      expect(hash1).not.toBe(hash2);
    });
  });
});
