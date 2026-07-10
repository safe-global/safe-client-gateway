// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { FieldCryptoService } from '@/datasources/kms/field-crypto.service';
import { SpaceFieldEncryptionService } from '@/modules/spaces/domain/space-field-encryption.service';

const fieldCryptoService = {
  isEncrypted: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  blindIndex: vi.fn(),
  emailBlindIndex: vi.fn(),
} as unknown as MockedObject<FieldCryptoService>;

describe('SpaceFieldEncryptionService', () => {
  let target: SpaceFieldEncryptionService;
  const spaceId = faker.number.int({ min: 1, max: 100_000 });

  beforeEach(() => {
    vi.resetAllMocks();
    // Tagging fakes make the (field, scope, value) wiring visible in outputs.
    fieldCryptoService.encrypt.mockImplementation((_field, _scope, value) =>
      Promise.resolve(`enc:${value}`),
    );
    fieldCryptoService.decrypt.mockImplementation((_field, _scope, value) =>
      Promise.resolve(`dec:${value}`),
    );
    fieldCryptoService.blindIndex.mockReturnValue('index-token');
    fieldCryptoService.isEncrypted.mockImplementation((value: string) =>
      value.startsWith('kms:'),
    );
    target = new SpaceFieldEncryptionService(fieldCryptoService);
  });

  describe('isEncrypted', () => {
    it('delegates to FieldCryptoService', () => {
      expect(target.isEncrypted('kms:v1:abc')).toBe(true);
      expect(target.isEncrypted('plain')).toBe(false);
      expect(fieldCryptoService.isEncrypted).toHaveBeenCalledTimes(2);
    });
  });

  describe('spaces.name', () => {
    it('encryptSpaceName encrypts under spaces.name with a space scope', async () => {
      const name = faker.word.noun();

      await expect(target.encryptSpaceName(spaceId, name)).resolves.toBe(
        `enc:${name}`,
      );
      expect(fieldCryptoService.encrypt).toHaveBeenCalledExactlyOnceWith(
        'spaces.name',
        { spaceId },
        name,
      );
    });

    it('decryptSpaceName decrypts under spaces.name with a space scope', async () => {
      await expect(target.decryptSpaceName(spaceId, 'kms:v1:x')).resolves.toBe(
        'dec:kms:v1:x',
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledExactlyOnceWith(
        'spaces.name',
        { spaceId },
        'kms:v1:x',
      );
    });

    it('decryptSpaces decrypts each space under its own id and leaves the input untouched', async () => {
      const spaces = [
        { id: 1, name: 'kms:v1:a' },
        { id: 2, name: 'kms:v1:b' },
      ];

      const result = await target.decryptSpaces(spaces);

      expect(result).toStrictEqual([
        { id: 1, name: 'dec:kms:v1:a' },
        { id: 2, name: 'dec:kms:v1:b' },
      ]);
      expect(spaces[0].name).toBe('kms:v1:a');
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        1,
        'spaces.name',
        { spaceId: 1 },
        'kms:v1:a',
      );
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        2,
        'spaces.name',
        { spaceId: 2 },
        'kms:v1:b',
      );
    });
  });

  describe('space_safes.address', () => {
    it('encryptSafeAddress encrypts under space_safes.address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(target.encryptSafeAddress(spaceId, address)).resolves.toBe(
        `enc:${address}`,
      );
      expect(fieldCryptoService.encrypt).toHaveBeenCalledExactlyOnceWith(
        'space_safes.address',
        { spaceId },
        address,
      );
    });

    it('safeAddressIndex computes the blind index under space_safes.address', () => {
      const address = getAddress(faker.finance.ethereumAddress());

      expect(target.safeAddressIndex(address)).toBe('index-token');
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
        'space_safes.address',
        address,
      );
    });

    it('safeAddressIndex returns null when no index key is configured', () => {
      fieldCryptoService.blindIndex.mockReturnValue(null);

      expect(
        target.safeAddressIndex(getAddress(faker.finance.ethereumAddress())),
      ).toBeNull();
    });

    it('decryptSpaceSafes decrypts each address under the space scope, leaving other members untouched', async () => {
      const safes = [
        { chainId: '1', address: 'kms:v1:a' },
        { chainId: '2', address: 'kms:v1:b' },
      ];

      const result = await target.decryptSpaceSafes(spaceId, safes);

      expect(result).toStrictEqual([
        { chainId: '1', address: 'dec:kms:v1:a' },
        { chainId: '2', address: 'dec:kms:v1:b' },
      ]);
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        1,
        'space_safes.address',
        { spaceId },
        'kms:v1:a',
      );
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        2,
        'space_safes.address',
        { spaceId },
        'kms:v1:b',
      );
    });
  });

  describe('space_address_book_items', () => {
    it('encryptAddressBookItem encrypts both members and computes the address index', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = faker.word.noun();

      const result = await target.encryptAddressBookItem(spaceId, {
        address,
        name,
      });

      expect(result).toStrictEqual({
        address: `enc:${address}`,
        name: `enc:${name}`,
        addressIndex: 'index-token',
      });
      expect(fieldCryptoService.encrypt).toHaveBeenCalledWith(
        'space_address_book_items.address',
        { spaceId },
        address,
      );
      expect(fieldCryptoService.encrypt).toHaveBeenCalledWith(
        'space_address_book_items.name',
        { spaceId },
        name,
      );
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
        'space_address_book_items.address',
        address,
      );
    });

    it('itemAddressIndex computes the blind index under space_address_book_items.address', () => {
      const address = getAddress(faker.finance.ethereumAddress());

      expect(target.itemAddressIndex(address)).toBe('index-token');
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
        'space_address_book_items.address',
        address,
      );
    });

    it('decryptAddressBookItems decrypts address and name per item', async () => {
      const items = [
        { address: 'kms:v1:a', name: 'kms:v1:n', chainIds: ['1'] },
      ];

      const result = await target.decryptAddressBookItems(spaceId, items);

      expect(result).toStrictEqual([
        { address: 'dec:kms:v1:a', name: 'dec:kms:v1:n', chainIds: ['1'] },
      ]);
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        'space_address_book_items.address',
        { spaceId },
        'kms:v1:a',
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        'space_address_book_items.name',
        { spaceId },
        'kms:v1:n',
      );
    });
  });

  describe('address_book_requests', () => {
    it('encryptAddressBookRequest encrypts both members under the request field ids', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const name = faker.word.noun();

      const result = await target.encryptAddressBookRequest(spaceId, {
        address,
        name,
      });

      expect(result).toStrictEqual({
        address: `enc:${address}`,
        name: `enc:${name}`,
        addressIndex: 'index-token',
      });
      expect(fieldCryptoService.encrypt).toHaveBeenCalledWith(
        'address_book_requests.address',
        { spaceId },
        address,
      );
      expect(fieldCryptoService.encrypt).toHaveBeenCalledWith(
        'address_book_requests.name',
        { spaceId },
        name,
      );
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
        'address_book_requests.address',
        address,
      );
    });

    it('requestAddressIndex computes the blind index under address_book_requests.address', () => {
      const address = getAddress(faker.finance.ethereumAddress());

      expect(target.requestAddressIndex(address)).toBe('index-token');
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
        'address_book_requests.address',
        address,
      );
    });

    it('decryptAddressBookRequests decrypts address and name per request', async () => {
      const requests = [
        { address: 'kms:v1:a', name: 'kms:v1:n', status: 'PENDING' },
      ];

      const result = await target.decryptAddressBookRequests(spaceId, requests);

      expect(result).toStrictEqual([
        { address: 'dec:kms:v1:a', name: 'dec:kms:v1:n', status: 'PENDING' },
      ]);
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        'address_book_requests.address',
        { spaceId },
        'kms:v1:a',
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        'address_book_requests.name',
        { spaceId },
        'kms:v1:n',
      );
    });
  });

  describe('decryptAuditPayload', () => {
    it('decrypts SPACE_CREATED and SPACE_DELETED names under spaces.name', async () => {
      await expect(
        target.decryptAuditPayload(spaceId, 'SPACE_CREATED', {
          name: 'kms:v1:x',
        }),
      ).resolves.toStrictEqual({ name: 'dec:kms:v1:x' });
      await expect(
        target.decryptAuditPayload(spaceId, 'SPACE_DELETED', {
          name: 'kms:v1:y',
        }),
      ).resolves.toStrictEqual({ name: 'dec:kms:v1:y' });
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        1,
        'spaces.name',
        { spaceId },
        'kms:v1:x',
      );
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        2,
        'spaces.name',
        { spaceId },
        'kms:v1:y',
      );
    });

    it('decrypts SPACE_UPDATED old/new names, leaving status members untouched', async () => {
      await expect(
        target.decryptAuditPayload(spaceId, 'SPACE_UPDATED', {
          old: { name: 'kms:v1:a', status: 'ACTIVE' },
          new: { name: 'kms:v1:b', status: 'ACTIVE' },
        }),
      ).resolves.toStrictEqual({
        old: { name: 'dec:kms:v1:a', status: 'ACTIVE' },
        new: { name: 'dec:kms:v1:b', status: 'ACTIVE' },
      });
    });

    it('passes a status-only SPACE_UPDATED diff through without decrypting', async () => {
      const payload = { old: { status: 'ACTIVE' }, new: { status: 'ACTIVE' } };

      await expect(
        target.decryptAuditPayload(spaceId, 'SPACE_UPDATED', payload),
      ).resolves.toStrictEqual(payload);
      expect(fieldCryptoService.decrypt).not.toHaveBeenCalled();
    });

    it('decrypts SAFE_ADDED and SAFE_REMOVED addresses under space_safes.address', async () => {
      const payload = {
        safes: [
          { chainId: '1', address: 'kms:v1:a' },
          { chainId: '2', address: 'kms:v1:b' },
        ],
      };

      await expect(
        target.decryptAuditPayload(spaceId, 'SAFE_ADDED', payload),
      ).resolves.toStrictEqual({
        safes: [
          { chainId: '1', address: 'dec:kms:v1:a' },
          { chainId: '2', address: 'dec:kms:v1:b' },
        ],
      });
      await expect(
        target.decryptAuditPayload(spaceId, 'SAFE_REMOVED', payload),
      ).resolves.toStrictEqual({
        safes: [
          { chainId: '1', address: 'dec:kms:v1:a' },
          { chainId: '2', address: 'dec:kms:v1:b' },
        ],
      });
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        'space_safes.address',
        { spaceId },
        'kms:v1:a',
      );
    });

    it('decrypts ADDRESS_BOOK_UPSERTED created and updated entries under the item field ids', async () => {
      await expect(
        target.decryptAuditPayload(spaceId, 'ADDRESS_BOOK_UPSERTED', {
          created: [{ address: 'kms:v1:a', name: 'kms:v1:n' }],
          updated: [{ address: 'kms:v1:b', name: 'kms:v1:m' }],
          onBehalfOfUserId: 7,
        }),
      ).resolves.toStrictEqual({
        created: [{ address: 'dec:kms:v1:a', name: 'dec:kms:v1:n' }],
        updated: [{ address: 'dec:kms:v1:b', name: 'dec:kms:v1:m' }],
        onBehalfOfUserId: 7,
      });
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        'space_address_book_items.address',
        { spaceId },
        'kms:v1:a',
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        'space_address_book_items.name',
        { spaceId },
        'kms:v1:m',
      );
    });

    it('decrypts ADDRESS_BOOK_DELETED address and name', async () => {
      await expect(
        target.decryptAuditPayload(spaceId, 'ADDRESS_BOOK_DELETED', {
          address: 'kms:v1:a',
          name: 'kms:v1:n',
        }),
      ).resolves.toStrictEqual({
        address: 'dec:kms:v1:a',
        name: 'dec:kms:v1:n',
      });
    });

    it('returns member events untouched without any decrypt call', async () => {
      const payload = { targetUserId: 7 };

      await expect(
        target.decryptAuditPayload(spaceId, 'MEMBER_INVITED', payload),
      ).resolves.toStrictEqual(payload);
      expect(fieldCryptoService.decrypt).not.toHaveBeenCalled();
    });
  });
});
