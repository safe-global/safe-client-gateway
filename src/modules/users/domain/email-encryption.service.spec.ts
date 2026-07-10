// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import { createMockFieldCryptoService } from '@/datasources/kms/__tests__/field-crypto.service.mock';
import type { FieldCryptoService } from '@/datasources/kms/field-crypto.service';
import { EmailEncryptionService } from '@/modules/users/domain/email-encryption.service';

describe('EmailEncryptionService', () => {
  let fieldCrypto: MockedObject<FieldCryptoService>;
  let target: EmailEncryptionService;

  beforeEach(() => {
    fieldCrypto = createMockFieldCryptoService();
    target = new EmailEncryptionService(fieldCrypto);
  });

  it('isEncrypted delegates to FieldCryptoService', () => {
    expect(target.isEncrypted('kms:v1:abc')).toBe(true);
    expect(target.isEncrypted('a@b.com')).toBe(false);
    expect(fieldCrypto.isEncrypted).toHaveBeenCalledTimes(2);
  });

  it('blindIndex uses the legacy email construction, never the segmented one', () => {
    fieldCrypto.emailBlindIndex.mockReturnValue('legacy-token');

    expect(target.blindIndex(' A@B.com ')).toBe('legacy-token');
    expect(fieldCrypto.emailBlindIndex).toHaveBeenCalledExactlyOnceWith(
      ' A@B.com ',
    );
    expect(fieldCrypto.blindIndex).not.toHaveBeenCalled();
  });

  it('encrypt binds users.email and the owning userId', async () => {
    fieldCrypto.encrypt.mockResolvedValue('kms:v1:ciphertext');

    await expect(target.encrypt(42, 'a@b.com')).resolves.toBe(
      'kms:v1:ciphertext',
    );
    expect(fieldCrypto.encrypt).toHaveBeenCalledExactlyOnceWith(
      'users.email',
      { userId: 42 },
      'a@b.com',
    );
  });

  it('decrypt binds users.email and the owning userId', async () => {
    fieldCrypto.decrypt.mockResolvedValue('a@b.com');

    await expect(target.decrypt(42, 'kms:v1:ciphertext')).resolves.toBe(
      'a@b.com',
    );
    expect(fieldCrypto.decrypt).toHaveBeenCalledExactlyOnceWith(
      'users.email',
      { userId: 42 },
      'kms:v1:ciphertext',
    );
  });

  describe('decryptUserEmails', () => {
    it('returns decrypted copies, leaving the input untouched', async () => {
      fieldCrypto.decrypt.mockImplementation((_field, _scope, value) =>
        Promise.resolve(value.replace('kms:v1:', '')),
      );
      const users = [
        { id: 1, email: 'kms:v1:a@b.com' },
        { id: 2, email: null },
      ];

      const result = await target.decryptUserEmails(users);

      expect(result).toStrictEqual([
        { id: 1, email: 'a@b.com' },
        { id: 2, email: null },
      ]);
      expect(users[0].email).toBe('kms:v1:a@b.com');
      expect(fieldCrypto.decrypt).toHaveBeenCalledExactlyOnceWith(
        'users.email',
        { userId: 1 },
        'kms:v1:a@b.com',
      );
    });
  });
});
