// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import { createMockKmsEncryptionService } from '@/datasources/kms/__tests__/kms-encryption.service.mock';
import type { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';
import { UserEncryptionService } from '@/modules/users/domain/user-encryption.service';

describe('UserEncryptionService', () => {
  let fieldCrypto: MockedObject<KmsEncryptionService>;
  let target: UserEncryptionService;

  beforeEach(() => {
    fieldCrypto = createMockKmsEncryptionService();
    target = new UserEncryptionService(fieldCrypto);
  });

  it('isEncrypted delegates to KmsEncryptionService', () => {
    expect(target.isEncrypted('kms:v1:abc')).toBe(true);
    expect(target.isEncrypted('a@b.com')).toBe(false);
    expect(fieldCrypto.isEncrypted).toHaveBeenCalledTimes(2);
  });

  it('blindIndex delegates to KmsEncryptionService with just the value', () => {
    fieldCrypto.blindIndex.mockReturnValue('email-token');

    expect(target.blindIndex(' A@B.com ')).toBe('email-token');
    expect(fieldCrypto.blindIndex).toHaveBeenCalledExactlyOnceWith(' A@B.com ');
  });

  it('encrypt binds the owning userId', async () => {
    fieldCrypto.encrypt.mockResolvedValue('kms:v1:ciphertext');

    await expect(target.encrypt(42, 'a@b.com')).resolves.toBe(
      'kms:v1:ciphertext',
    );
    expect(fieldCrypto.encrypt).toHaveBeenCalledExactlyOnceWith('a@b.com', {
      userId: '42',
    });
  });

  it('decrypt binds the owning userId', async () => {
    fieldCrypto.decrypt.mockResolvedValue('a@b.com');

    await expect(target.decrypt(42, 'kms:v1:ciphertext')).resolves.toBe(
      'a@b.com',
    );
    expect(fieldCrypto.decrypt).toHaveBeenCalledExactlyOnceWith(
      'kms:v1:ciphertext',
      { userId: '42' },
    );
  });

  describe('decryptUserEmails', () => {
    it('returns decrypted copies, leaving the input untouched', async () => {
      fieldCrypto.decrypt.mockImplementation((value, _ctx) =>
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
        'kms:v1:a@b.com',
        { userId: '1' },
      );
    });
  });
});
