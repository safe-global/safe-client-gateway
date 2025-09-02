import type {
  DeleteResult,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  InsertResult,
} from 'typeorm';
import { type Repository, type EntityManager } from 'typeorm';
import type { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import type { User } from '@/domain/users/entities/user.entity';
import type { Address } from 'viem';

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
