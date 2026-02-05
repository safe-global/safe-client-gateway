import { encryptData, decryptData } from '@/domain/common/utils/encryption';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

describe('Encryption Utils', () => {
  const testKey = faker.string.alphanumeric();
  const testSalt = faker.string.alphanumeric();
  const testData = {
    addresses: faker.helpers.multiple(
      () => getAddress(faker.finance.ethereumAddress()),
      { count: { min: 10, max: 20 } },
    ),
  };

  describe('encryptData', () => {
    it('should encrypt data successfully', () => {
      const encrypted = encryptData(testData, testKey, testSalt);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should produce different encrypted values for the same input (different IVs)', () => {
      const encrypted1 = encryptData(testData, testKey, testSalt);
      const encrypted2 = encryptData(testData, testKey, testSalt);

      // Due to random IV, encrypted values should be different
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw an error if encryption key is not provided', () => {
      expect(() => encryptData(testData, '', testSalt)).toThrow(
        'Encryption key and salt are required',
      );
    });

    it('should encrypt different data types', () => {
      const stringData = 'test string';
      const numberData = 12345;
      const arrayData = [1, 2, 3, 4, 5];
      const objectData = { key: 'value', nested: { prop: 'test' } };

      const encryptedString = encryptData(stringData, testKey, testSalt);
      const encryptedNumber = encryptData(numberData, testKey, testSalt);
      const encryptedArray = encryptData(arrayData, testKey, testSalt);
      const encryptedObject = encryptData(objectData, testKey, testSalt);

      expect(encryptedString).toBeDefined();
      expect(encryptedNumber).toBeDefined();
      expect(encryptedArray).toBeDefined();
      expect(encryptedObject).toBeDefined();
    });

    it('should use custom salt when provided', () => {
      const customSalt = 'custom-salt';
      const defaultSalt = 'default-salt';
      const encrypted1 = encryptData(testData, testKey, customSalt);
      const encrypted2 = encryptData(testData, testKey, defaultSalt);

      // Different salts should produce different results (after decryption attempts)
      expect(encrypted1).toBeDefined();
      expect(encrypted2).toBeDefined();
    });
  });

  describe('decryptData', () => {
    it('should decrypt encrypted data successfully', () => {
      const encrypted = encryptData(testData, testKey, testSalt);
      const decrypted = decryptData<typeof testData>(
        encrypted,
        testKey,
        testSalt,
      );

      expect(decrypted).toEqual(testData);
    });

    it('should decrypt different data types', () => {
      const stringData = 'test string';
      const numberData = 12345;
      const arrayData = [1, 2, 3, 4, 5];
      const objectData = { key: 'value', nested: { prop: 'test' } };

      const encryptedString = encryptData(stringData, testKey, testSalt);
      const encryptedNumber = encryptData(numberData, testKey, testSalt);
      const encryptedArray = encryptData(arrayData, testKey, testSalt);
      const encryptedObject = encryptData(objectData, testKey, testSalt);

      const decryptedString = decryptData<string>(
        encryptedString,
        testKey,
        testSalt,
      );
      const decryptedNumber = decryptData<number>(
        encryptedNumber,
        testKey,
        testSalt,
      );
      const decryptedArray = decryptData<Array<number>>(
        encryptedArray,
        testKey,
        testSalt,
      );
      const decryptedObject = decryptData<typeof objectData>(
        encryptedObject,
        testKey,
        testSalt,
      );

      expect(decryptedString).toBe(stringData);
      expect(decryptedNumber).toBe(numberData);
      expect(decryptedArray).toEqual(arrayData);
      expect(decryptedObject).toEqual(objectData);
    });

    it('should throw an error if decryption key is not provided', () => {
      const encrypted = encryptData(testData, testKey, testSalt);

      expect(() => decryptData(encrypted, '', testSalt)).toThrow(
        'Decryption data and configuration are required',
      );
    });

    it('should throw an error if encrypted data is not provided', () => {
      expect(() => decryptData('', testKey, testSalt)).toThrow(
        'Decryption data and configuration are required',
      );
    });

    it('should throw an error if decryption key is incorrect', () => {
      const encrypted = encryptData(testData, testKey, testSalt);
      const wrongKey = 'wrong-key';

      expect(() => decryptData(encrypted, wrongKey, testSalt)).toThrow(
        'Failed to decrypt data',
      );
    });

    it('should throw an error if encrypted data is corrupted', () => {
      const corrupted = 'corrupted-base64-data';

      expect(() => decryptData(corrupted, testKey, testSalt)).toThrow(
        'Failed to decrypt data',
      );
    });

    it('should decrypt with custom salt when provided', () => {
      const customSalt = 'custom-salt';
      const encrypted = encryptData(testData, testKey, customSalt);
      const decrypted = decryptData<typeof testData>(
        encrypted,
        testKey,
        customSalt,
      );

      expect(decrypted).toEqual(testData);
    });

    it('should fail to decrypt if salt mismatch', () => {
      const customSalt = 'custom-salt';
      const wrongSalt = 'wrong-salt';
      const encrypted = encryptData(testData, testKey, customSalt);

      // Try to decrypt with wrong salt (should fail)
      expect(() => decryptData(encrypted, testKey, wrongSalt)).toThrow(
        'Failed to decrypt data',
      );
    });
  });

  describe('encryption/decryption round-trip', () => {
    it('should successfully encrypt and decrypt with different keys producing different results', () => {
      const key1 = 'encryption-key-1';
      const key2 = 'encryption-key-2';

      const encrypted1 = encryptData(testData, key1, testSalt);
      const encrypted2 = encryptData(testData, key2, testSalt);

      // Different keys produce different encrypted values
      expect(encrypted1).not.toBe(encrypted2);

      // Each can only be decrypted with its own key
      const decrypted1 = decryptData<typeof testData>(
        encrypted1,
        key1,
        testSalt,
      );
      expect(decrypted1).toEqual(testData);

      expect(() => decryptData(encrypted1, key2, testSalt)).toThrow(
        'Failed to decrypt data',
      );
    });

    it('should handle large data sets', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        address: `0x${i.toString(16).padStart(40, '0')}`,
        value: Math.random(),
      }));

      const encrypted = encryptData(largeData, testKey, testSalt);
      const decrypted = decryptData<typeof largeData>(
        encrypted,
        testKey,
        testSalt,
      );

      expect(decrypted).toEqual(largeData);
      expect(decrypted.length).toBe(10000);
    });
  });
});
