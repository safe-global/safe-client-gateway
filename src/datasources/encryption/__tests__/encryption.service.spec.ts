// SPDX-License-Identifier: FSL-1.1-MIT
import { EncryptionService } from '@/datasources/encryption/encryption.service';
import { faker } from '@faker-js/faker/.';
import { randomBytes } from 'crypto';

const dekV1 = randomBytes(32);
const dekV2 = randomBytes(32);
const hmacKey = randomBytes(32);

describe('EncryptionService', () => {
  describe('constructor validation', () => {
    it('should throw if no DEK versions are provided', () => {
      expect(() => new EncryptionService(new Map(), 1, hmacKey)).toThrow(
        'At least one DEK version must be provided',
      );
    });

    it('should throw if current version is not in the DEK map', () => {
      const deks = new Map([[1, dekV1]]);

      expect(() => new EncryptionService(deks, 2, hmacKey)).toThrow(
        'Current version 2 not found in DEK versions [1]',
      );
    });

    it('should throw if a DEK is not 32 bytes', () => {
      const shortKey = randomBytes(16);
      const deks = new Map([[1, shortKey]]);

      expect(() => new EncryptionService(deks, 1, hmacKey)).toThrow(
        'DEK for version 1 must be 32 bytes, got 16',
      );
    });

    it('should accept valid single-DEK configuration', () => {
      const deks = new Map([[1, dekV1]]);

      expect(() => new EncryptionService(deks, 1, hmacKey)).not.toThrow();
    });

    it('should accept valid multi-DEK configuration', () => {
      const deks = new Map([
        [1, dekV1],
        [2, dekV2],
      ]);

      expect(() => new EncryptionService(deks, 2, hmacKey)).not.toThrow();
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    let service: EncryptionService;

    beforeEach(() => {
      const deks = new Map([[1, dekV1]]);
      service = new EncryptionService(deks, 1, hmacKey);
    });

    it('should encrypt and decrypt a string', () => {
      const plaintext = faker.person.fullName();

      const { ciphertext, version } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext, version);

      expect(decrypted).toBe(plaintext);
    });

    it('should return the current version with encrypted output', () => {
      const { version } = service.encrypt('test');

      expect(version).toBe(1);
    });

    it('should produce raw base64 ciphertext without version prefix', () => {
      const { ciphertext } = service.encrypt('test');

      expect(ciphertext).not.toMatch(/^v\d+:/);
      expect(() => Buffer.from(ciphertext, 'base64')).not.toThrow();
    });

    it('should produce different ciphertexts for the same plaintext', () => {
      const plaintext = faker.person.fullName();

      const { ciphertext: ct1 } = service.encrypt(plaintext);
      const { ciphertext: ct2 } = service.encrypt(plaintext);

      expect(ct1).not.toBe(ct2);
    });

    it('should handle empty strings', () => {
      const { ciphertext, version } = service.encrypt('');
      const decrypted = service.decrypt(ciphertext, version);

      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Ünïcödé 🎉 テスト';

      const { ciphertext, version } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext, version);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = faker.lorem.paragraphs(10);

      const { ciphertext, version } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext, version);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('DEK rotation (v1 → v2)', () => {
    it('should encrypt with current version DEK', () => {
      const deks = new Map([
        [1, dekV1],
        [2, dekV2],
      ]);
      const service = new EncryptionService(deks, 2, hmacKey);

      const { version } = service.encrypt('test');

      expect(version).toBe(2);
    });

    it('should decrypt old data (v1) after rotating to v2', () => {
      // Phase 1: encrypt with v1
      const serviceV1 = new EncryptionService(
        new Map([[1, dekV1]]),
        1,
        hmacKey,
      );
      const { ciphertext: oldCt } = serviceV1.encrypt('old-data');

      // Phase 2: deploy new service with both keys, current = v2
      const serviceV2 = new EncryptionService(
        new Map([
          [1, dekV1],
          [2, dekV2],
        ]),
        2,
        hmacKey,
      );

      // Old data still decrypts with v1
      expect(serviceV2.decrypt(oldCt, 1)).toBe('old-data');

      // New data encrypts with v2
      const { ciphertext: newCt, version } = serviceV2.encrypt('new-data');
      expect(version).toBe(2);
      expect(serviceV2.decrypt(newCt, 2)).toBe('new-data');
    });

    it('should re-encrypt v1 data as v2 (simulates backfill)', () => {
      const deks = new Map([
        [1, dekV1],
        [2, dekV2],
      ]);

      // Encrypt with v1
      const serviceV1 = new EncryptionService(deks, 1, hmacKey);
      const { ciphertext: v1Ct } = serviceV1.encrypt('migrate-me');

      // Re-encrypt: decrypt with v1, encrypt with v2
      const serviceV2 = new EncryptionService(deks, 2, hmacKey);
      const plaintext = serviceV2.decrypt(v1Ct, 1);
      const { ciphertext: v2Ct, version } = serviceV2.encrypt(plaintext);

      expect(version).toBe(2);
      expect(serviceV2.decrypt(v2Ct, 2)).toBe('migrate-me');
    });

    it('should fail to decrypt v1 data with v2 key (key isolation)', () => {
      const serviceV1 = new EncryptionService(
        new Map([[1, dekV1]]),
        1,
        hmacKey,
      );
      const { ciphertext } = serviceV1.encrypt('secret');

      // Service with ONLY v2 — v1 key is gone
      const serviceV2Only = new EncryptionService(
        new Map([[2, dekV2]]),
        2,
        hmacKey,
      );

      expect(() => serviceV2Only.decrypt(ciphertext, 1)).toThrow(
        'No DEK found for encryption version 1',
      );
    });
  });

  describe('app restart / DEK determinism', () => {
    it('should decrypt after restart with same key material', () => {
      // Simulate first boot
      const service1 = new EncryptionService(
        new Map([[1, dekV1]]),
        1,
        hmacKey,
      );
      const { ciphertext, version } = service1.encrypt('survive-restart');

      // Simulate restart — new instance, same key bytes
      const service2 = new EncryptionService(
        new Map([[1, Buffer.from(dekV1)]]),
        1,
        Buffer.from(hmacKey),
      );

      expect(service2.decrypt(ciphertext, version)).toBe('survive-restart');
    });

    it('should produce same HMAC after restart with same key', () => {
      const service1 = new EncryptionService(
        new Map([[1, dekV1]]),
        1,
        hmacKey,
      );
      const hash1 = service1.hmac('0xABC123');

      // Restart
      const service2 = new EncryptionService(
        new Map([[1, Buffer.from(dekV1)]]),
        1,
        Buffer.from(hmacKey),
      );
      const hash2 = service2.hmac('0xABC123');

      expect(hash1).toBe(hash2);
    });

    it('should fail to decrypt if DEK is lost (different key on restart)', () => {
      const service1 = new EncryptionService(
        new Map([[1, dekV1]]),
        1,
        hmacKey,
      );
      const { ciphertext, version } = service1.encrypt('lost-key-test');

      // Restart with WRONG key (simulates DEK loss)
      const wrongKey = randomBytes(32);
      const service2 = new EncryptionService(
        new Map([[1, wrongKey]]),
        1,
        hmacKey,
      );

      expect(() => service2.decrypt(ciphertext, version)).toThrow();
    });
  });

  describe('KMS exchange (yearly key rotation)', () => {
    it('should support full migration lifecycle: v1-only → v1+v2 → v2-only', () => {
      const plaintext = 'yearly-rotation-test';

      // Step 1: v1 only
      const phase1 = new EncryptionService(
        new Map([[1, dekV1]]),
        1,
        hmacKey,
      );
      const { ciphertext: v1Ct } = phase1.encrypt(plaintext);

      // Step 2: deploy with both keys, write as v2
      const phase2 = new EncryptionService(
        new Map([
          [1, dekV1],
          [2, dekV2],
        ]),
        2,
        hmacKey,
      );
      // Old v1 data still readable
      expect(phase2.decrypt(v1Ct, 1)).toBe(plaintext);
      // New writes go to v2
      const { ciphertext: v2Ct, version } = phase2.encrypt(plaintext);
      expect(version).toBe(2);

      // Step 3: backfill complete — re-encrypted v1 → v2
      const reEncrypted = phase2.encrypt(phase2.decrypt(v1Ct, 1));
      expect(reEncrypted.version).toBe(2);

      // Step 4: remove v1 key (all data is v2 now)
      const phase3 = new EncryptionService(
        new Map([[2, dekV2]]),
        2,
        hmacKey,
      );
      expect(phase3.decrypt(v2Ct, 2)).toBe(plaintext);
      expect(phase3.decrypt(reEncrypted.ciphertext, 2)).toBe(plaintext);

      // v1 data can no longer be decrypted
      expect(() => phase3.decrypt(v1Ct, 1)).toThrow(
        'No DEK found for encryption version 1',
      );
    });
  });

  describe('encryption_version field semantics', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(
        new Map([
          [1, dekV1],
          [2, dekV2],
        ]),
        2,
        hmacKey,
      );
    });

    it('version=null means plaintext — no decryption needed', () => {
      const fieldValue = 'John Doe';
      const encryptionVersion: number | null = null;

      // Simulates what the transformer/subscriber would do:
      const result =
        encryptionVersion !== null
          ? service.decrypt(fieldValue, encryptionVersion)
          : fieldValue;

      expect(result).toBe('John Doe');
    });

    it('version=1 means encrypted with v1 DEK', () => {
      const { ciphertext } = new EncryptionService(
        new Map([[1, dekV1]]),
        1,
        hmacKey,
      ).encrypt('encrypted-name');
      const encryptionVersion: number | null = 1;

      const result =
        encryptionVersion !== null
          ? service.decrypt(ciphertext, encryptionVersion)
          : ciphertext;

      expect(result).toBe('encrypted-name');
    });

    it('version=2 means encrypted with v2 DEK', () => {
      const { ciphertext } = service.encrypt('v2-encrypted');
      const encryptionVersion: number | null = 2;

      const result =
        encryptionVersion !== null
          ? service.decrypt(ciphertext, encryptionVersion)
          : ciphertext;

      expect(result).toBe('v2-encrypted');
    });

    it('plaintext that looks like base64 is not accidentally decrypted when version=null', () => {
      // This is the false-positive case the version column prevents
      const fieldValue = 'dGVzdA=='; // base64 for "test"
      const encryptionVersion: number | null = null;

      const result =
        encryptionVersion !== null
          ? service.decrypt(fieldValue, encryptionVersion)
          : fieldValue;

      expect(result).toBe('dGVzdA==');
    });
  });

  describe('tamper detection (AES-GCM integrity)', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(new Map([[1, dekV1]]), 1, hmacKey);
    });

    it('should detect tampered ciphertext', () => {
      const { ciphertext, version } = service.encrypt('tamper-test');
      const payload = Buffer.from(ciphertext, 'base64');

      // Flip a byte in the encrypted data portion (after IV + auth tag)
      const tamperedIndex = 12 + 16 + 1; // IV(12) + tag(16) + 1
      if (payload.length > tamperedIndex) {
        payload[tamperedIndex] ^= 0xff;
      }

      const tampered = payload.toString('base64');
      expect(() => service.decrypt(tampered, version)).toThrow();
    });

    it('should detect tampered auth tag', () => {
      const { ciphertext, version } = service.encrypt('tag-tamper');
      const payload = Buffer.from(ciphertext, 'base64');

      // Flip a byte in the auth tag (bytes 12-27)
      payload[14] ^= 0xff;

      const tampered = payload.toString('base64');
      expect(() => service.decrypt(tampered, version)).toThrow();
    });

    it('should detect tampered IV', () => {
      const { ciphertext, version } = service.encrypt('iv-tamper');
      const payload = Buffer.from(ciphertext, 'base64');

      // Flip a byte in the IV (bytes 0-11)
      payload[5] ^= 0xff;

      const tampered = payload.toString('base64');
      expect(() => service.decrypt(tampered, version)).toThrow();
    });

    it('should reject truncated ciphertext', () => {
      expect(() => service.decrypt('dGVzdA==', 1)).toThrow(
        'Ciphertext too short',
      );
    });

    it('should reject empty ciphertext', () => {
      expect(() => service.decrypt('', 1)).toThrow('Ciphertext too short');
    });

    it('should reject unknown version', () => {
      const { ciphertext } = service.encrypt('test');

      expect(() => service.decrypt(ciphertext, 99)).toThrow(
        'No DEK found for encryption version 99. Available versions: [1]',
      );
    });

    it('should reject invalid base64 ciphertext', () => {
      expect(() => service.decrypt('!!!', 1)).toThrow();
    });

    it('should reject base64 that decodes to wrong-length garbage', () => {
      const garbage = Buffer.alloc(40).toString('base64');
      expect(() => service.decrypt(garbage, 1)).toThrow();
    });
  });

  describe('hmac', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(new Map([[1, dekV1]]), 1, hmacKey);
    });

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

    it('should produce different hashes with different HMAC keys', () => {
      const otherHmacKey = randomBytes(32);
      const otherService = new EncryptionService(
        new Map([[1, dekV1]]),
        1,
        otherHmacKey,
      );

      const hash1 = service.hmac('same-input');
      const hash2 = otherService.hmac('same-input');

      expect(hash1).not.toBe(hash2);
    });

    it('should survive restart with same HMAC key', () => {
      const hash1 = service.hmac('deterministic');

      const restarted = new EncryptionService(
        new Map([[1, dekV1]]),
        1,
        Buffer.from(hmacKey),
      );

      expect(restarted.hmac('deterministic')).toBe(hash1);
    });
  });
});
