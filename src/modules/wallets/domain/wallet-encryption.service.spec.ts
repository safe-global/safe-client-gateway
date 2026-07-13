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
      fieldCryptoService.isEncrypted.mockReturnValue(true);

      expect(target.isEncrypted('kms:v1:abc')).toBe(true);
      expect(fieldCryptoService.isEncrypted).toHaveBeenCalledExactlyOnceWith(
        'kms:v1:abc',
      );
    });
  });

  describe('encryptAddress', () => {
    it('encrypts scoped to the owning user', async () => {
      const userId = faker.number.int({ min: 1 });
      const address = getAddress(faker.finance.ethereumAddress());
      fieldCryptoService.encrypt.mockResolvedValue('kms:v1:ciphertext');

      await expect(target.encryptAddress(userId, address)).resolves.toBe(
        'kms:v1:ciphertext',
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
      fieldCryptoService.blindIndex.mockReturnValue('address-token');

      expect(target.addressIndex(address)).toBe('address-token');
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
      fieldCryptoService.decrypt.mockResolvedValue(address);

      await expect(
        target.decryptAddress(userId, 'kms:v1:ciphertext'),
      ).resolves.toBe(address);
      expect(fieldCryptoService.decrypt).toHaveBeenCalledExactlyOnceWith(
        'kms:v1:ciphertext',
        { userId: String(userId) },
      );
    });
  });

  describe('decryptWallets', () => {
    it('returns copies with decrypted addresses, leaving the input untouched', async () => {
      const userId = faker.number.int({ min: 1 });
      const plaintextA = getAddress(faker.finance.ethereumAddress());
      const plaintextB = getAddress(faker.finance.ethereumAddress());
      fieldCryptoService.decrypt
        .mockResolvedValueOnce(plaintextA)
        .mockResolvedValueOnce(plaintextB);
      const wallets = [
        { id: 1, address: 'kms:v1:a' },
        { id: 2, address: 'kms:v1:b' },
      ];

      const decrypted = await target.decryptWallets(userId, wallets);

      expect(decrypted).toStrictEqual([
        { id: 1, address: plaintextA },
        { id: 2, address: plaintextB },
      ]);
      // The input rows keep their stored (encrypted) values.
      expect(wallets[0].address).toBe('kms:v1:a');
      expect(fieldCryptoService.decrypt).toHaveBeenCalledTimes(2);
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith('kms:v1:a', {
        userId: String(userId),
      });
      expect(fieldCryptoService.decrypt).toHaveBeenCalledWith('kms:v1:b', {
        userId: String(userId),
      });
    });
  });
});
