import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { type EntityManager } from 'typeorm';
import type {
  DeleteResult,
  FindOptionsRelations,
  FindOptionsSelect,
  InsertResult,
} from 'typeorm';
import type { User } from '@/domain/users/entities/user.entity';
import type { IWalletsRepository } from '@/domain/wallets/wallets.repository.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { EntityRepository } from '@/domain/common/entity.repository';
import type { IEntityRepository } from '@/domain/common/entity.repository.inferface';

@Injectable()
export class WalletsRepository
  extends EntityRepository<Wallet>
  implements IWalletsRepository, IEntityRepository<Wallet>
{
  constructor(
    @Inject(PostgresDatabaseService)
    readonly postgresDatabaseService: PostgresDatabaseService,
  ) {
    super(postgresDatabaseService, Wallet);
  }

  public async findOneByAddressOrFail(
    address: `0x${string}`,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet> {
    const wallet = await this.findOneByAddress(address, relations);

    if (!wallet) {
      throw new NotFoundException('Wallet not found. Address=' + address);
    }

    return wallet;
  }

  public async findOneByAddress(
    address: `0x${string}`,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet | null> {
    return await this.findOne({
      where: { address },
      relations,
    });
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
      walletAddress: `0x${string}`;
    },
    entityManager: EntityManager,
  ): Promise<InsertResult> {
    return await entityManager.insert(this.entity, {
      user: {
        id: args.userId,
      },
      address: args.walletAddress,
    });
  }

  public async deleteByAddress(address: `0x${string}`): Promise<DeleteResult> {
    const walletRepository = await this.getRepository();

    return await walletRepository.delete({
      address,
    });
  }
}
