// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  DeleteResult,
  EntityManager,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  InsertResult,
} from 'typeorm';
import type { Address } from 'viem';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

@Injectable()
export class WalletsRepository implements IWalletsRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    private readonly walletEncryptionService: WalletEncryptionService,
  ) {}

  public async findOneOrFail(
    where: Array<FindOptionsWhere<Wallet>> | FindOptionsWhere<Wallet>,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet> {
    const wallet = await this.findOne(where, relations);

    if (!wallet) {
      throw new NotFoundException('Wallet not found.');
    }

    return wallet;
  }

  public async findOne(
    where: Array<FindOptionsWhere<Wallet>> | FindOptionsWhere<Wallet>,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet | null> {
    const walletRepository =
      await this.postgresDatabaseService.getRepository(Wallet);

    return await walletRepository.findOne({
      where,
      relations,
    });
  }

  public async findOrFail(args: {
    where: Array<FindOptionsWhere<Wallet>> | FindOptionsWhere<Wallet>;
    select?: FindOptionsSelect<Wallet>;
    relations?: FindOptionsRelations<Wallet>;
  }): Promise<Array<Wallet>> {
    const wallets = await this.find(args);

    if (wallets.length === 0) {
      throw new NotFoundException('Wallets not found.');
    }

    return wallets;
  }

  public async find(args: {
    where: Array<FindOptionsWhere<Wallet>> | FindOptionsWhere<Wallet>;
    select?: FindOptionsSelect<Wallet>;
    relations?: FindOptionsRelations<Wallet>;
  }): Promise<Array<Wallet>> {
    const walletRepository =
      await this.postgresDatabaseService.getRepository(Wallet);

    return await walletRepository.find(args);
  }

  public async findOneByAddressOrFail(
    address: Address,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet> {
    const wallet = await this.findOneByAddress(address, relations);

    if (!wallet) {
      throw new NotFoundException(`Wallet not found. Address=${address}`);
    }

    return wallet;
  }

  public async findOneByAddress(
    address: Address,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet | null> {
    // Match encrypted rows on the blind index; with encryption disabled
    // (no index key configured) the address is stored and matched as plaintext.
    const addressIndex = this.walletEncryptionService.addressIndex(address);
    const wallet = await this.findOne(
      addressIndex ? { addressIndex } : { address },
      relations,
    );
    if (wallet && this.walletEncryptionService.isEncrypted(wallet.address)) {
      // The row matched this plaintext's blind index, so the caller's
      // (checksummed) input IS the plaintext - no KMS round trip needed.
      wallet.address = address;
    }
    return wallet;
  }

  public async findByUser(
    userId: User['id'],
    select?: FindOptionsSelect<Wallet>,
  ): Promise<Array<Wallet>> {
    const wallets = await this.find({
      select,
      where: {
        user: {
          id: userId,
        },
      },
    });
    // Single-owner list: every wallet belongs to userId, so addresses are
    // decrypted here at the repository boundary.
    return await this.walletEncryptionService.decryptWallets(userId, wallets);
  }

  public async create(
    args: {
      userId: number;
      walletAddress: Address;
    },
    entityManager: EntityManager,
  ): Promise<InsertResult> {
    // The owning userId is known before the insert, so the ciphertext and
    // blind index are computed up front - no two-phase update like email.
    // With encryption disabled both calls pass through (plaintext, no index).
    const addressIndex = this.walletEncryptionService.addressIndex(
      args.walletAddress,
    );
    const address = (await this.walletEncryptionService.encryptAddress(
      args.userId,
      args.walletAddress,
    )) as Address;

    return await entityManager.insert(Wallet, {
      user: {
        id: args.userId,
      },
      address,
      ...(addressIndex && { addressIndex }),
    });
  }

  public async deleteByAddress(address: Address): Promise<DeleteResult> {
    const walletRepository =
      await this.postgresDatabaseService.getRepository(Wallet);

    const addressIndex = this.walletEncryptionService.addressIndex(address);
    return await walletRepository.delete(
      addressIndex ? { addressIndex } : { address },
    );
  }
}
