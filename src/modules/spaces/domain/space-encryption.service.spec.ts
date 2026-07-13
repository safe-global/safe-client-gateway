// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';
import { SpaceEncryptionService } from '@/modules/spaces/domain/space-encryption.service';

const fieldCryptoService = {
  isEncrypted: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  blindIndex: vi.fn(),
} as unknown as MockedObject<KmsEncryptionService>;

/** A ciphertext-shaped value, as produced by {@link KmsEncryptionService}. */
const ciphertext = (): string => `kms:v1:${faker.string.alphanumeric(16)}`;

describe('SpaceEncryptionService', () => {
  let target: SpaceEncryptionService;
  const spaceId = faker.number.int({ min: 1, max: 100_000 });

  beforeEach(() => {
    vi.resetAllMocks();
    // Tagging fakes make the (value, context) wiring visible in outputs.
    fieldCryptoService.encrypt.mockImplementation((value, _ctx) =>
      Promise.resolve(`enc:${value}`),
    );
    fieldCryptoService.decrypt.mockImplementation((value, _ctx) =>
      Promise.resolve(`dec:${value}`),
    );
    fieldCryptoService.blindIndex.mockReturnValue('index-token');
    fieldCryptoService.isEncrypted.mockImplementation((value: string) =>
      value.startsWith('kms:'),
    );
    target = new SpaceEncryptionService(fieldCryptoService);
  });

  describe('isEncrypted', () => {
    it('delegates to KmsEncryptionService', () => {
      expect(target.isEncrypted(ciphertext())).toBe(true);
      expect(target.isEncrypted(faker.word.noun())).toBe(false);
      expect(fieldCryptoService.isEncrypted).toHaveBeenCalledTimes(2);
    });
  });

  describe('space name', () => {
    it('encryptSpaceName encrypts with a space scope', async () => {
      const name = faker.word.noun();

      await expect(target.encryptSpaceName(spaceId, name)).resolves.toBe(
        `enc:${name}`,
      );
      expect(fieldCryptoService.encrypt).toHaveBeenCalledExactlyOnceWith(name, {
        spaceId: String(spaceId),
      });
    });

    it('decryptSpaceName decrypts with a space scope', async () => {
      const value = ciphertext();

      await expect(target.decryptSpaceName(spaceId, value)).resolves.toBe(
        `dec:${value}`,
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledExactlyOnceWith(
        value,
        {
          spaceId: String(spaceId),
        },
      );
    });

    it('decryptSpaces decrypts each space under its own id and leaves the input untouched', async () => {
      const spaces = [
        { id: faker.number.int({ min: 1, max: 100_000 }), name: ciphertext() },
        { id: faker.number.int({ min: 1, max: 100_000 }), name: ciphertext() },
      ];
      const originalName = spaces[0].name;

      const result = await target.decryptSpaces(spaces);

      expect(result).toStrictEqual([
        { id: spaces[0].id, name: `dec:${originalName}` },
        { id: spaces[1].id, name: `dec:${spaces[1].name}` },
      ]);
      expect(spaces[0].name).toBe(originalName);
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        1,
        spaces[0].name,
        { spaceId: String(spaces[0].id) },
      );
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        2,
        spaces[1].name,
        { spaceId: String(spaces[1].id) },
      );
    });
  });

  describe('space safe address', () => {
    it('encryptSafeAddress encrypts with a space scope', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(target.encryptSafeAddress(spaceId, address)).resolves.toBe(
        `enc:${address}`,
      );
      expect(fieldCryptoService.encrypt).toHaveBeenCalledExactlyOnceWith(
        address,
        { spaceId: String(spaceId) },
      );
    });

    it('safeAddressIndex computes the blind index over just the value', () => {
      const address = getAddress(faker.finance.ethereumAddress());

      expect(target.safeAddressIndex(address)).toBe('index-token');
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
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
        { chainId: faker.string.numeric(), address: ciphertext() },
        { chainId: faker.string.numeric(), address: ciphertext() },
      ];

      const result = await target.decryptSpaceSafes(spaceId, safes);

      expect(result).toStrictEqual([
        { chainId: safes[0].chainId, address: `dec:${safes[0].address}` },
        { chainId: safes[1].chainId, address: `dec:${safes[1].address}` },
      ]);
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        1,
        safes[0].address,
        { spaceId: String(spaceId) },
      );
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        2,
        safes[1].address,
        { spaceId: String(spaceId) },
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
      expect(fieldCryptoService.encrypt).toHaveBeenCalledWith(address, {
        spaceId: String(spaceId),
      });
      expect(fieldCryptoService.encrypt).toHaveBeenCalledWith(name, {
        spaceId: String(spaceId),
      });
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
        address,
      );
    });

    it('itemAddressIndex computes the blind index over just the value', () => {
      const address = getAddress(faker.finance.ethereumAddress());

      expect(target.itemAddressIndex(address)).toBe('index-token');
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
        address,
      );
    });

    it('decryptAddressBookItems decrypts address and name per item', async () => {
      const items = [
        {
          address: ciphertext(),
          name: ciphertext(),
          chainIds: [faker.string.numeric()],
        },
      ];

      const result = await target.decryptAddressBookItems(spaceId, items);

      expect(result).toStrictEqual([
        {
          address: `dec:${items[0].address}`,
          name: `dec:${items[0].name}`,
          chainIds: items[0].chainIds,
        },
      ]);
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        items[0].address,
        {
          spaceId: String(spaceId),
        },
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(items[0].name, {
        spaceId: String(spaceId),
      });
    });
  });

  describe('address_book_requests', () => {
    it('encryptAddressBookRequest encrypts both members and computes the address index', async () => {
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
      expect(fieldCryptoService.encrypt).toHaveBeenCalledWith(address, {
        spaceId: String(spaceId),
      });
      expect(fieldCryptoService.encrypt).toHaveBeenCalledWith(name, {
        spaceId: String(spaceId),
      });
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
        address,
      );
    });

    it('requestAddressIndex computes the blind index over just the value', () => {
      const address = getAddress(faker.finance.ethereumAddress());

      expect(target.requestAddressIndex(address)).toBe('index-token');
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
        address,
      );
    });

    it('decryptAddressBookRequests decrypts address and name per request', async () => {
      const requests = [
        {
          address: ciphertext(),
          name: ciphertext(),
          status: faker.lorem.word(),
        },
      ];

      const result = await target.decryptAddressBookRequests(spaceId, requests);

      expect(result).toStrictEqual([
        {
          address: `dec:${requests[0].address}`,
          name: `dec:${requests[0].name}`,
          status: requests[0].status,
        },
      ]);
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        requests[0].address,
        { spaceId: String(spaceId) },
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        requests[0].name,
        {
          spaceId: String(spaceId),
        },
      );
    });
  });

  describe('decryptAuditPayload', () => {
    it('decrypts SPACE_CREATED and SPACE_DELETED names under the space scope', async () => {
      const createdName = ciphertext();
      const deletedName = ciphertext();

      await expect(
        target.decryptAuditPayload(spaceId, 'SPACE_CREATED', {
          name: createdName,
        }),
      ).resolves.toStrictEqual({ name: `dec:${createdName}` });
      await expect(
        target.decryptAuditPayload(spaceId, 'SPACE_DELETED', {
          name: deletedName,
        }),
      ).resolves.toStrictEqual({ name: `dec:${deletedName}` });
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        1,
        createdName,
        { spaceId: String(spaceId) },
      );
      expect(fieldCryptoService.decrypt).toHaveBeenNthCalledWith(
        2,
        deletedName,
        { spaceId: String(spaceId) },
      );
    });

    it('decrypts SPACE_UPDATED old/new names, leaving status members untouched', async () => {
      const oldName = ciphertext();
      const newName = ciphertext();
      const status = faker.lorem.word();

      await expect(
        target.decryptAuditPayload(spaceId, 'SPACE_UPDATED', {
          old: { name: oldName, status },
          new: { name: newName, status },
        }),
      ).resolves.toStrictEqual({
        old: { name: `dec:${oldName}`, status },
        new: { name: `dec:${newName}`, status },
      });
    });

    it('passes a status-only SPACE_UPDATED diff through without decrypting', async () => {
      const status = faker.lorem.word();
      const payload = { old: { status }, new: { status } };

      await expect(
        target.decryptAuditPayload(spaceId, 'SPACE_UPDATED', payload),
      ).resolves.toStrictEqual(payload);
      expect(fieldCryptoService.decrypt).not.toHaveBeenCalled();
    });

    it('decrypts SAFE_ADDED and SAFE_REMOVED addresses under the space scope', async () => {
      const payload = {
        safes: [
          { chainId: faker.string.numeric(), address: ciphertext() },
          { chainId: faker.string.numeric(), address: ciphertext() },
        ],
      };

      await expect(
        target.decryptAuditPayload(spaceId, 'SAFE_ADDED', payload),
      ).resolves.toStrictEqual({
        safes: [
          {
            chainId: payload.safes[0].chainId,
            address: `dec:${payload.safes[0].address}`,
          },
          {
            chainId: payload.safes[1].chainId,
            address: `dec:${payload.safes[1].address}`,
          },
        ],
      });
      await expect(
        target.decryptAuditPayload(spaceId, 'SAFE_REMOVED', payload),
      ).resolves.toStrictEqual({
        safes: [
          {
            chainId: payload.safes[0].chainId,
            address: `dec:${payload.safes[0].address}`,
          },
          {
            chainId: payload.safes[1].chainId,
            address: `dec:${payload.safes[1].address}`,
          },
        ],
      });
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        payload.safes[0].address,
        { spaceId: String(spaceId) },
      );
    });

    it('decrypts ADDRESS_BOOK_UPSERTED created and updated entries under the space scope', async () => {
      const created = [{ address: ciphertext(), name: ciphertext() }];
      const updated = [{ address: ciphertext(), name: ciphertext() }];
      const onBehalfOfUserId = faker.number.int({ min: 1, max: 100_000 });

      await expect(
        target.decryptAuditPayload(spaceId, 'ADDRESS_BOOK_UPSERTED', {
          created,
          updated,
          onBehalfOfUserId,
        }),
      ).resolves.toStrictEqual({
        created: [
          {
            address: `dec:${created[0].address}`,
            name: `dec:${created[0].name}`,
          },
        ],
        updated: [
          {
            address: `dec:${updated[0].address}`,
            name: `dec:${updated[0].name}`,
          },
        ],
        onBehalfOfUserId,
      });
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(
        created[0].address,
        { spaceId: String(spaceId) },
      );
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(updated[0].name, {
        spaceId: String(spaceId),
      });
    });

    it('decrypts ADDRESS_BOOK_DELETED address and name', async () => {
      const address = ciphertext();
      const name = ciphertext();

      await expect(
        target.decryptAuditPayload(spaceId, 'ADDRESS_BOOK_DELETED', {
          address,
          name,
        }),
      ).resolves.toStrictEqual({
        address: `dec:${address}`,
        name: `dec:${name}`,
      });
    });

    it('returns member events untouched without any decrypt call', async () => {
      const payload = {
        targetUserId: faker.number.int({ min: 1, max: 100_000 }),
      };

      await expect(
        target.decryptAuditPayload(spaceId, 'MEMBER_INVITED', payload),
      ).resolves.toStrictEqual(payload);
      expect(fieldCryptoService.decrypt).not.toHaveBeenCalled();
    });
  });
});
