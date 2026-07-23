// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
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
    expect(target.isEncrypted(`kms:v1:${faker.string.alphanumeric(24)}`)).toBe(
      true,
    );
    expect(target.isEncrypted(faker.internet.email())).toBe(false);
    expect(fieldCrypto.isEncrypted).toHaveBeenCalledTimes(2);
  });

  it('blindIndex delegates to KmsEncryptionService with just the value', () => {
    const token = faker.string.alphanumeric(24);
    // Surrounding whitespace/casing to show the value is passed through verbatim.
    const value = `  ${faker.internet.email().toUpperCase()}  `;
    fieldCrypto.blindIndex.mockReturnValue(token);

    expect(target.blindIndex(value)).toBe(token);
    expect(fieldCrypto.blindIndex).toHaveBeenCalledExactlyOnceWith(value);
  });

  it('encrypt binds the owning userId', async () => {
    const userId = faker.number.int({ min: 1 });
    const email = faker.internet.email();
    const ciphertext = `kms:v1:${faker.string.alphanumeric(24)}`;
    fieldCrypto.encrypt.mockResolvedValue(ciphertext);

    await expect(target.encrypt(userId, email)).resolves.toBe(ciphertext);
    expect(fieldCrypto.encrypt).toHaveBeenCalledExactlyOnceWith(email, {
      userId: String(userId),
    });
  });

  it('decrypt binds the owning userId', async () => {
    const userId = faker.number.int({ min: 1 });
    const email = faker.internet.email();
    const ciphertext = `kms:v1:${faker.string.alphanumeric(24)}`;
    fieldCrypto.decrypt.mockResolvedValue(email);

    await expect(target.decrypt(userId, ciphertext)).resolves.toBe(email);
    expect(fieldCrypto.decrypt).toHaveBeenCalledExactlyOnceWith(ciphertext, {
      userId: String(userId),
    });
  });

  describe('decryptUserEmails', () => {
    it('returns decrypted copies, leaving the input untouched', async () => {
      const encryptedUserId = faker.number.int({ min: 1 });
      const email = faker.internet.email();
      const encryptedEmail = `kms:v1:${email}`;
      const nullEmailUser = {
        id: faker.number.int({ min: 1 }),
        email: null,
      };
      fieldCrypto.decrypt.mockImplementation((value, _ctx) =>
        Promise.resolve(value.replace('kms:v1:', '')),
      );
      const users = [
        { id: encryptedUserId, email: encryptedEmail },
        nullEmailUser,
      ];

      const result = await target.decryptUserEmails(users);

      expect(result).toStrictEqual([
        { id: encryptedUserId, email },
        nullEmailUser,
      ]);
      expect(users[0].email).toBe(encryptedEmail);
      expect(fieldCrypto.decrypt).toHaveBeenCalledExactlyOnceWith(
        encryptedEmail,
        { userId: String(encryptedUserId) },
      );
    });
  });
});
