// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { IsNull } from 'typeorm';
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
        insert: vi.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
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
      const entityManager = {
        insert: vi.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
      };
      walletEncryptionService.addressIndex.mockReturnValue('address-token');
      walletEncryptionService.encryptAddress.mockResolvedValue(
        'kms:v1:ciphertext',
      );

      await target.create({ userId, walletAddress }, entityManager as never);

      expect(walletEncryptionService.encryptAddress).toHaveBeenCalledWith(
        userId,
        walletAddress,
      );
      expect(entityManager.insert).toHaveBeenCalledWith(Wallet, {
        user: { id: userId },
        address: 'kms:v1:ciphertext',
        addressIndex: 'address-token',
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

    it('should dual-read by blind index and plaintext, returning the caller plaintext for an encrypted row', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      walletEncryptionService.addressIndex.mockReturnValue('address-token');
      walletRepository.findOne.mockResolvedValue({
        id: 1,
        address: 'kms:v1:ciphertext',
        addressIndex: 'address-token',
      });

      const wallet = await target.findOneByAddress(address);

      expect(walletRepository.findOne).toHaveBeenCalledWith({
        where: [
          { addressIndex: 'address-token' },
          { addressIndex: IsNull(), address },
        ],
        relations: undefined,
      });
      expect(wallet?.address).toBe(address);
    });
  });

  describe('findByUser', () => {
    it('should decrypt the addresses of the returned wallets', async () => {
      const userId = faker.number.int({ min: 1 });
      const address = getAddress(faker.finance.ethereumAddress());
      walletRepository.find.mockResolvedValue([
        { id: 1, address: 'kms:v1:ciphertext' },
      ]);
      walletEncryptionService.decryptWallets.mockResolvedValue([
        { id: 1, address },
      ] as never);

      await expect(target.findByUser(userId)).resolves.toStrictEqual([
        { id: 1, address },
      ]);
      expect(walletEncryptionService.decryptWallets).toHaveBeenCalledWith(
        userId,
        [{ id: 1, address: 'kms:v1:ciphertext' }],
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

    it('should find matching rows via dual-read and delete them by id when an index key is configured', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      walletEncryptionService.addressIndex.mockReturnValue('address-token');
      walletRepository.find.mockResolvedValue([{ id: 4 }]);
      walletRepository.delete.mockResolvedValue({ raw: [], affected: 1 });

      await target.deleteByAddress(address);

      expect(walletRepository.find).toHaveBeenCalledWith({
        where: [
          { addressIndex: 'address-token' },
          { addressIndex: IsNull(), address },
        ],
        select: { id: true },
      });
      expect(walletRepository.delete).toHaveBeenCalledWith([4]);
    });

    it('should not delete anything when no rows match', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      walletEncryptionService.addressIndex.mockReturnValue('address-token');
      walletRepository.find.mockResolvedValue([]);

      await expect(target.deleteByAddress(address)).resolves.toStrictEqual({
        raw: [],
        affected: 0,
      });
      expect(walletRepository.delete).not.toHaveBeenCalled();
    });
  });
});
