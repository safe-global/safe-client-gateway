// SPDX-License-Identifier: FSL-1.1-MIT
import { EncryptionLocator } from '@/datasources/encryption/encryption-locator';
import type { IEncryptionService } from '@/datasources/encryption/encryption.service.interface';

const mockService = {
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  hmac: jest.fn(),
  currentVersion: 1,
} as jest.MockedObjectDeep<IEncryptionService>;

describe('EncryptionLocator', () => {
  afterEach(() => {
    EncryptionLocator.reset();
  });

  it('should throw when service is not set', () => {
    expect(() => EncryptionLocator.getService()).toThrow(
      'EncryptionLocator: service not set',
    );
  });

  it('should return the service after it is set', () => {
    EncryptionLocator.setService(mockService);

    expect(EncryptionLocator.getService()).toBe(mockService);
  });

  it('should reset the service', () => {
    EncryptionLocator.setService(mockService);
    EncryptionLocator.reset();

    expect(() => EncryptionLocator.getService()).toThrow();
  });

  describe('getServiceOrNull', () => {
    it('should return null when service is not set', () => {
      expect(EncryptionLocator.getServiceOrNull()).toBeNull();
    });

    it('should return the service after it is set', () => {
      EncryptionLocator.setService(mockService);

      expect(EncryptionLocator.getServiceOrNull()).toBe(mockService);
    });

    it('should return null after reset', () => {
      EncryptionLocator.setService(mockService);
      EncryptionLocator.reset();

      expect(EncryptionLocator.getServiceOrNull()).toBeNull();
    });
  });
});
