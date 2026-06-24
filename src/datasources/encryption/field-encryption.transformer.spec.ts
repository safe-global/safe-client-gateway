// SPDX-License-Identifier: FSL-1.1-MIT

import { FieldEncryptionRegistry } from '@/datasources/encryption/field-encryption.registry';
import type { IFieldEncryptionService } from '@/datasources/encryption/field-encryption.service.interface';
import { fieldEncryptionTransformer } from '@/datasources/encryption/field-encryption.transformer';

describe('fieldEncryptionTransformer', () => {
  const aad = 'spaces.name';
  const transformer = fieldEncryptionTransformer(aad);

  afterEach(() => {
    FieldEncryptionRegistry.set(undefined);
  });

  describe('when no service is registered', () => {
    it('passes values through unchanged (write and read)', () => {
      expect(transformer.to('My Space')).toBe('My Space');
      expect(transformer.from('My Space')).toBe('My Space');
    });

    it('passes null and undefined through unchanged', () => {
      expect(transformer.to(null)).toBeNull();
      expect(transformer.to(undefined)).toBeUndefined();
      expect(transformer.from(null)).toBeNull();
      expect(transformer.from(undefined)).toBeUndefined();
    });
  });

  describe('when a service is registered', () => {
    const service = {
      encrypt: vi.fn(),
      encryptDeterministic: vi.fn(),
      decrypt: vi.fn(),
      isEncrypted: vi.fn(),
    } satisfies IFieldEncryptionService;

    beforeEach(() => {
      vi.resetAllMocks();
      FieldEncryptionRegistry.set(service);
    });

    it('encrypts on write with the column AAD', () => {
      service.encrypt.mockReturnValue('cipher');

      expect(transformer.to('plain')).toBe('cipher');
      expect(service.encrypt).toHaveBeenCalledWith('plain', aad);
    });

    it('decrypts on read with the column AAD', () => {
      service.decrypt.mockReturnValue('plain');

      expect(transformer.from('cipher')).toBe('plain');
      expect(service.decrypt).toHaveBeenCalledWith('cipher', aad);
    });

    it('does not call the service for null or undefined', () => {
      expect(transformer.to(null)).toBeNull();
      expect(transformer.from(undefined)).toBeUndefined();
      expect(service.encrypt).not.toHaveBeenCalled();
      expect(service.decrypt).not.toHaveBeenCalled();
    });

    it('uses deterministic encryption when configured', () => {
      const deterministic = fieldEncryptionTransformer(aad, {
        deterministic: true,
      });
      service.encryptDeterministic.mockReturnValue('det-cipher');

      expect(deterministic.to('plain')).toBe('det-cipher');
      expect(service.encryptDeterministic).toHaveBeenCalledWith('plain', aad);
      expect(service.encrypt).not.toHaveBeenCalled();
    });
  });
});
