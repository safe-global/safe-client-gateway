// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import type { FieldCryptoService } from '@/datasources/kms/field-crypto.service';
import { MemberEncryptionService } from '@/modules/users/domain/members/member-encryption.service';

// Plain vi.fn() mock: the wrapper is policy only — these tests assert the
// exact (field, scope, value) wiring into FieldCryptoService and nothing else.
const fieldCryptoService = {
  isEncrypted: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  blindIndex: vi.fn(),
} as unknown as MockedObject<FieldCryptoService>;

describe('MemberEncryptionService', () => {
  let target: MemberEncryptionService;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new MemberEncryptionService(fieldCryptoService);
  });

  describe('encryptName', () => {
    it("encrypts under 'members.name' scoped to the owning space", async () => {
      const spaceId = faker.number.int({ min: 1 });
      const name = faker.person.firstName();
      fieldCryptoService.encrypt.mockResolvedValue('kms:v1:name');

      await expect(target.encryptName(spaceId, name)).resolves.toBe(
        'kms:v1:name',
      );
      expect(fieldCryptoService.encrypt).toHaveBeenCalledExactlyOnceWith(
        'members.name',
        { spaceId },
        name,
      );
    });
  });

  describe('encryptAlias', () => {
    it("encrypts under 'members.alias' scoped to the owning space", async () => {
      const spaceId = faker.number.int({ min: 1 });
      const alias = faker.person.firstName();
      fieldCryptoService.encrypt.mockResolvedValue('kms:v1:alias');

      await expect(target.encryptAlias(spaceId, alias)).resolves.toBe(
        'kms:v1:alias',
      );
      expect(fieldCryptoService.encrypt).toHaveBeenCalledExactlyOnceWith(
        'members.alias',
        { spaceId },
        alias,
      );
    });
  });

  describe('decryptName', () => {
    it("decrypts under 'members.name' scoped to the owning space", async () => {
      const spaceId = faker.number.int({ min: 1 });
      const name = faker.person.firstName();
      fieldCryptoService.decrypt.mockResolvedValue(name);

      await expect(target.decryptName(spaceId, 'kms:v1:name')).resolves.toBe(
        name,
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledExactlyOnceWith(
        'members.name',
        { spaceId },
        'kms:v1:name',
      );
    });
  });

  describe('decryptMembers', () => {
    it('returns copies with decrypted name and alias, leaving the input untouched and skipping null aliases', async () => {
      const spaceId = faker.number.int({ min: 1 });
      fieldCryptoService.decrypt.mockImplementation(
        (_field, _scope, value: string) =>
          Promise.resolve(value.replace('kms:v1:', 'plain:')),
      );
      const members = [
        { id: 1, name: 'kms:v1:name-a', alias: 'kms:v1:alias-a' },
        { id: 2, name: 'kms:v1:name-b', alias: null },
      ];

      const decrypted = await target.decryptMembers(spaceId, members);

      expect(decrypted).toStrictEqual([
        { id: 1, name: 'plain:name-a', alias: 'plain:alias-a' },
        { id: 2, name: 'plain:name-b', alias: null },
      ]);
      // The input rows keep their stored (encrypted) values.
      expect(members[0].name).toBe('kms:v1:name-a');
      expect(fieldCryptoService.decrypt).toHaveBeenCalledTimes(3);
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        'members.name',
        { spaceId },
        'kms:v1:name-a',
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        'members.alias',
        { spaceId },
        'kms:v1:alias-a',
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        'members.name',
        { spaceId },
        'kms:v1:name-b',
      );
    });
  });
});
