// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';
import { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';

// Plain vi.fn() mock: the wrapper is policy only — these tests assert the
// exact (value, context) wiring into KmsEncryptionService and nothing else.
const fieldCryptoService = {
  isEncrypted: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  blindIndex: vi.fn(),
} as unknown as MockedObject<KmsEncryptionService>;

describe('WalletEncryptionService', () => {
  let target: WalletEncryptionService;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new WalletEncryptionService(fieldCryptoService);
  });

  describe('isEncrypted', () => {
    it('delegates to KmsEncryptionService', () => {
      const value = `kms:v1:${faker.string.alphanumeric(16)}`;
      fieldCryptoService.isEncrypted.mockReturnValue(true);

      expect(target.isEncrypted(value)).toBe(true);
      expect(fieldCryptoService.isEncrypted).toHaveBeenCalledExactlyOnceWith(
        value,
      );
    });
  });

  describe('encryptAddress', () => {
    it('encrypts scoped to the owning user', async () => {
      const userId = faker.number.int({ min: 1 });
      const address = getAddress(faker.finance.ethereumAddress());
      const ciphertext = `kms:v1:${faker.string.alphanumeric(16)}`;
      fieldCryptoService.encrypt.mockResolvedValue(ciphertext);

      await expect(target.encryptAddress(userId, address)).resolves.toBe(
        ciphertext,
      );
      expect(fieldCryptoService.encrypt).toHaveBeenCalledExactlyOnceWith(
        address,
        { userId: String(userId) },
      );
    });
  });

  describe('addressIndex', () => {
    it('computes the blind index over just the value', () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const token = faker.string.alphanumeric(16);
      fieldCryptoService.blindIndex.mockReturnValue(token);

      expect(target.addressIndex(address)).toBe(token);
      expect(fieldCryptoService.blindIndex).toHaveBeenCalledExactlyOnceWith(
        address,
      );
    });

    it('returns null when no index key is configured', () => {
      fieldCryptoService.blindIndex.mockReturnValue(null);

      expect(
        target.addressIndex(getAddress(faker.finance.ethereumAddress())),
      ).toBeNull();
    });
  });

  describe('decryptAddress', () => {
    it('decrypts scoped to the owning user', async () => {
      const userId = faker.number.int({ min: 1 });
      const address = getAddress(faker.finance.ethereumAddress());
      const ciphertext = `kms:v1:${faker.string.alphanumeric(16)}`;
      fieldCryptoService.decrypt.mockResolvedValue(address);

      await expect(
        target.decryptAddress(userId, ciphertext),
      ).resolves.toBe(address);
      expect(fieldCryptoService.decrypt).toHaveBeenCalledExactlyOnceWith(
        ciphertext,
        { userId: String(userId) },
      );
    });
  });

  describe('decryptWallets', () => {
    it('returns copies with decrypted addresses, leaving the input untouched', async () => {
      const userId = faker.number.int({ min: 1 });
      const idA = faker.number.int({ min: 1, max: 1000 });
      const idB = faker.number.int({ min: 1001, max: 2000 });
      const ciphertextA = `kms:v1:${faker.string.alphanumeric(16)}`;
      const ciphertextB = `kms:v1:${faker.string.alphanumeric(16)}`;
      const plaintextA = getAddress(faker.finance.ethereumAddress());
      const plaintextB = getAddress(faker.finance.ethereumAddress());
      fieldCryptoService.decrypt
        .mockResolvedValueOnce(plaintextA)
        .mockResolvedValueOnce(plaintextB);
      const wallets = [
        { id: idA, address: ciphertextA },
        { id: idB, address: ciphertextB },
      ];

      const decrypted = await target.decryptWallets(userId, wallets);

      expect(decrypted).toStrictEqual([
        { id: idA, address: plaintextA },
        { id: idB, address: plaintextB },
      ]);
      // The input rows keep their stored (encrypted) values.
      expect(wallets[0].address).toBe(ciphertextA);
      expect(fieldCryptoService.decrypt).toHaveBeenCalledTimes(2);
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(ciphertextA, {
        userId: String(userId),
      });
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith(ciphertextB, {
        userId: String(userId),
      });
    });
  });
});
