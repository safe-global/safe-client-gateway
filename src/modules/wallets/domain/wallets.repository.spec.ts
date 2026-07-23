// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { Mock, MockedObject } from 'vitest';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { createMockWalletEncryptionService } from '@/modules/wallets/domain/__tests__/wallet-encryption.service.mock';
import type { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';
import { WalletsRepository } from '@/modules/wallets/domain/wallets.repository';

describe('WalletsRepository', () => {
  let walletRepository: {
    find: Mock;
    findOne: Mock;
    delete: Mock;
  };
  let postgresDatabaseService: MockedObject<PostgresDatabaseService>;
  let walletEncryptionService: MockedObject<WalletEncryptionService>;
  let target: WalletsRepository;

  beforeEach(() => {
    vi.resetAllMocks();

    walletRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
    };
    postgresDatabaseService = {
      getRepository: vi.fn().mockResolvedValue(walletRepository),
    } as MockedObject<PostgresDatabaseService>;
    // Created after resetAllMocks so the passthrough implementations survive.
    walletEncryptionService = createMockWalletEncryptionService();

    target = new WalletsRepository(
      postgresDatabaseService,
      walletEncryptionService,
    );
  });

  describe('create', () => {
    it('should insert the plaintext address without an index when no index key is configured', async () => {
      const userId = faker.number.int({ min: 1 });
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const entityManager = {
        insert: vi
          .fn()
          .mockResolvedValue({ identifiers: [{ id: faker.number.int() }] }),
      };

      await target.create({ userId, walletAddress }, entityManager as never);

      expect(entityManager.insert).toHaveBeenCalledWith(Wallet, {
        user: { id: userId },
        address: walletAddress,
      });
    });

    it('should insert the encrypted address and its blind index when an index key is configured', async () => {
      const userId = faker.number.int({ min: 1 });
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const addressIndex = faker.string.alphanumeric(24);
      const ciphertext = `kms:v1:${faker.string.alphanumeric(24)}`;
      const entityManager = {
        insert: vi
          .fn()
          .mockResolvedValue({ identifiers: [{ id: faker.number.int() }] }),
      };
      walletEncryptionService.addressIndex.mockReturnValue(addressIndex);
      walletEncryptionService.encryptAddress.mockResolvedValue(ciphertext);

      await target.create({ userId, walletAddress }, entityManager as never);

      expect(walletEncryptionService.encryptAddress).toHaveBeenCalledWith(
        userId,
        walletAddress,
      );
      expect(entityManager.insert).toHaveBeenCalledWith(Wallet, {
        user: { id: userId },
        address: ciphertext,
        addressIndex,
      });
    });
  });

  describe('findOneByAddress', () => {
    it('should look up by plaintext when no index key is configured', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      walletRepository.findOne.mockResolvedValue(null);

      await expect(target.findOneByAddress(address)).resolves.toBeNull();
      expect(walletRepository.findOne).toHaveBeenCalledWith({
        where: { address },
        relations: undefined,
      });
    });

    it('should look up by blind index, returning the caller plaintext for an encrypted row', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const addressIndex = faker.string.alphanumeric(24);
      const ciphertext = `kms:v1:${faker.string.alphanumeric(24)}`;
      walletEncryptionService.addressIndex.mockReturnValue(addressIndex);
      walletRepository.findOne.mockResolvedValue({
        id: faker.number.int(),
        address: ciphertext,
        addressIndex,
      });

      const wallet = await target.findOneByAddress(address);

      expect(walletRepository.findOne).toHaveBeenCalledWith({
        where: { addressIndex },
        relations: undefined,
      });
      expect(wallet?.address).toBe(address);
    });
  });

  describe('findByUser', () => {
    it('should decrypt the addresses of the returned wallets', async () => {
      const userId = faker.number.int({ min: 1 });
      const walletId = faker.number.int();
      const address = getAddress(faker.finance.ethereumAddress());
      const ciphertext = `kms:v1:${faker.string.alphanumeric(24)}`;
      walletRepository.find.mockResolvedValue([
        { id: walletId, address: ciphertext },
      ]);
      walletEncryptionService.decryptWallets.mockResolvedValue([
        { id: walletId, address },
      ] as never);

      await expect(target.findByUser(userId)).resolves.toStrictEqual([
        { id: walletId, address },
      ]);
      expect(walletEncryptionService.decryptWallets).toHaveBeenCalledWith(
        userId,
        [{ id: walletId, address: ciphertext }],
      );
    });
  });

  describe('deleteByAddress', () => {
    it('should delete by plaintext when no index key is configured', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      walletRepository.delete.mockResolvedValue({ raw: [], affected: 1 });

      await expect(target.deleteByAddress(address)).resolves.toStrictEqual({
        raw: [],
        affected: 1,
      });
      expect(walletRepository.delete).toHaveBeenCalledWith({ address });
      expect(walletRepository.find).not.toHaveBeenCalled();
    });

    it('should delete by blind index when an index key is configured', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const addressIndex = faker.string.alphanumeric(24);
      walletEncryptionService.addressIndex.mockReturnValue(addressIndex);
      walletRepository.delete.mockResolvedValue({ raw: [], affected: 1 });

      await expect(target.deleteByAddress(address)).resolves.toStrictEqual({
        raw: [],
        affected: 1,
      });
      expect(walletRepository.delete).toHaveBeenCalledWith({ addressIndex });
      expect(walletRepository.find).not.toHaveBeenCalled();
    });
  });
});
