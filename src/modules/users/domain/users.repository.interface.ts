// SPDX-License-Identifier: FSL-1.1-MIT
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type {
  User,
  UserStatus,
} from '@/modules/users/domain/entities/user.entity';
import type { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import type { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';
import type {
  EntityManager,
  FindOptionsRelations,
  FindOptionsWhere,
} from 'typeorm';
import type { Address } from 'viem';

export const IUsersRepository = Symbol('IUsersRepository');

export interface IUsersRepository {
  findOneOrFail(
    where: Array<FindOptionsWhere<DbUser>> | FindOptionsWhere<DbUser>,
    relations?: FindOptionsRelations<DbUser>,
  ): Promise<DbUser>;

  createWithWallet(args: {
    status: keyof typeof UserStatus;
    authPayload: AuthPayload;
  }): Promise<Pick<User, 'id'>>;

  create(
    status: keyof typeof UserStatus,
    entityManager: EntityManager,
    options?: { extUserId?: string },
  ): Promise<User['id']>;

  getWithWallets(authPayload: AuthPayload): Promise<{
    id: User['id'];
    status: User['status'];
    wallets: Array<Pick<Wallet, 'address' | 'id'>>;
  }>;

  addWalletToUser(args: {
    walletAddress: Address;
    authPayload: AuthPayload;
  }): Promise<Pick<Wallet, 'id'>>;

  delete(authPayload: AuthPayload): Promise<void>;

  deleteWalletFromUser(args: {
    walletAddress: Address;
    authPayload: AuthPayload;
  }): Promise<void>;

  findByWalletAddressOrFail(address: Address): Promise<User>;

  findByWalletAddress(address: Address): Promise<User | undefined>;

  findOrCreateByWalletAddress(address: Address): Promise<User['id']>;

  findOrCreateByExtUserId(extUserId: string): Promise<User['id']>;

  ensureVerifiedEmail(userId: User['id'], email: string): Promise<void>;

  findEmailById(userId: User['id']): Promise<string | undefined>;

  update(args: {
    userId: User['id'];
    user: Partial<User>;
    entityManager: EntityManager;
  }): Promise<void>;

  updateStatus(args: {
    userId: User['id'];
    status: User['status'];
    entityManager: EntityManager;
  }): Promise<void>;

  activateIfPending(userId: User['id']): Promise<void>;
}
