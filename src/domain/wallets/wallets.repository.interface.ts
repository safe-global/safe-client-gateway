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
    address: `0x${string}`,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet>;

  findOneByAddress(
    address: `0x${string}`,
    relations?: FindOptionsRelations<Wallet>,
  ): Promise<Wallet | null>;

  findByUser(
    userId: User['id'],
    select?: FindOptionsSelect<Wallet>,
  ): Promise<Array<Wallet>>;

  create(
    args: {
      userId: number;
      walletAddress: `0x${string}`;
    },
    entityManager: EntityManager | Repository<Wallet>,
  ): Promise<InsertResult>;

  deleteByAddress(address: `0x${string}`): Promise<DeleteResult>;
}
