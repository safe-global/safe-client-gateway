import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { type EntityManager } from 'typeorm';
import type {
  DeleteResult,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  InsertResult,
} from 'typeorm';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { Address } from 'viem';

@Injectable()
export class WalletsRepository implements IWalletsRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
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
      throw new NotFoundException('Wallet not found. Address=' + address);
    }

    return wallet;
  }

  public async findOneByAddress(
    address: Address,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet | null> {
    return await this.findOne({ address }, relations);
  }

  public async findByUser(
    userId: User['id'],
    select?: FindOptionsSelect<Wallet>,
  ): Promise<Array<Wallet>> {
    return await this.find({
      select,
      where: {
        user: {
          id: userId,
        },
      },
    });
  }

  public async create(
    args: {
      userId: number;
      walletAddress: Address;
    },
    entityManager: EntityManager,
  ): Promise<InsertResult> {
    return await entityManager.insert(Wallet, {
      user: {
        id: args.userId,
      },
      address: args.walletAddress,
    });
  }

  public async deleteByAddress(address: Address): Promise<DeleteResult> {
    const walletRepository =
      await this.postgresDatabaseService.getRepository(Wallet);

    return await walletRepository.delete({
      address,
    });
  }
}
