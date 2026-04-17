import type {
  DeleteResult,
  EntityManager,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  InsertResult,
  Repository,
} from 'typeorm';
import type { Address } from 'viem';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';

export const IWalletsRepository = Symbol('IWalletsRepository');

export interface IWalletsRepository {
  findOneOrFail(
    where: Array<FindOptionsWhere<Wallet>> | FindOptionsWhere<Wallet>,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet>;

  findOne(
    where: Array<FindOptionsWhere<Wallet>> | FindOptionsWhere<Wallet>,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet | null>;

  findOrFail(args: {
    where: Array<FindOptionsWhere<Wallet>> | FindOptionsWhere<Wallet>;
    select?: FindOptionsSelect<Wallet>;
    relations?: FindOptionsRelations<Wallet>;
  }): Promise<Array<Wallet>>;

  find(args: {
    where: Array<FindOptionsWhere<Wallet>> | FindOptionsWhere<Wallet>;
    select?: FindOptionsSelect<Wallet>;
    relations?: FindOptionsRelations<Wallet>;
  }): Promise<Array<Wallet>>;

  findOneByAddressOrFail(
    address: Address,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet>;

  findOneByAddress(
    address: Address,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet | null>;

  findByUser(
    userId: User['id'],
    select?: FindOptionsSelect<Wallet>,
  ): Promise<Array<Wallet>>;

  create(
    args: {
      userId: number;
      walletAddress: Address;
    },
    entityManager: EntityManager | Repository<Wallet>,
  ): Promise<InsertResult>;

  deleteByAddress(address: Address): Promise<DeleteResult>;
}
