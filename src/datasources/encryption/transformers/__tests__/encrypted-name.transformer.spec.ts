// SPDX-License-Identifier: FSL-1.1-MIT
import { encryptedNameTransformer } from '@/datasources/encryption/transformers/encrypted-name.transformer';
import { EncryptionLocator } from '@/datasources/encryption/encryption-locator';
import type { IFieldEncryptionService } from '@/datasources/encryption/encryption.service.interface';

const mockService = {
  encrypt: jest.fn((v: string) => 'v1:enc-' + v),
  decrypt: jest.fn((v: string) => v.replace('v1:enc-', '')),
  hmac: jest.fn(),
} as unknown as jest.MockedObjectDeep<IFieldEncryptionService>;

describe('encryptedNameTransformer', () => {
  beforeAll(() => {
    EncryptionLocator.setService(mockService);
  });

  afterAll(() => {
    EncryptionLocator.reset();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('to (write to DB)', () => {
    it('should encrypt a non-null value', () => {
      const result = encryptedNameTransformer.to('Alice');

      expect(result).toBe('v1:enc-Alice');
      expect(mockService.encrypt).toHaveBeenCalledWith('Alice');
    });

    it('should return null for null input', () => {
      expect(encryptedNameTransformer.to(null)).toBeNull();
      expect(mockService.encrypt).not.toHaveBeenCalled();
    });

    it('should return null for empty string input', () => {
      expect(encryptedNameTransformer.to('')).toBeNull();
      expect(mockService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('from (read from DB)', () => {
    it('should decrypt a v1: prefixed value', () => {
      const result = encryptedNameTransformer.from('v1:enc-Alice');

      expect(result).toBe('Alice');
      expect(mockService.decrypt).toHaveBeenCalledWith('v1:enc-Alice');
    });

    it('should return plaintext as-is if no v1: prefix (dual-read)', () => {
      const result = encryptedNameTransformer.from('PlainAlice');

      expect(result).toBe('PlainAlice');
      expect(mockService.decrypt).not.toHaveBeenCalled();
    });

    it('should return null for null input', () => {
      expect(encryptedNameTransformer.from(null)).toBeNull();
      expect(mockService.decrypt).not.toHaveBeenCalled();
    });
  });
});
