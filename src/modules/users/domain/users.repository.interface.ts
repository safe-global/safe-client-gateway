// SPDX-License-Identifier: FSL-1.1-MIT

import type {
  EntityManager,
  FindOptionsRelations,
  FindOptionsWhere,
} from 'typeorm';
import type { Address } from 'viem';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';
import type {
  User,
  UserStatus,
} from '@/modules/users/domain/entities/user.entity';
import type { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import type { EmailAddress } from '@/validation/entities/schemas/email-address.schema';

export const IUsersRepository = Symbol('IUsersRepository');

export interface IUsersRepository {
  findOneOrFail(
    where: Array<FindOptionsWhere<DbUser>> | FindOptionsWhere<DbUser>,
    relations?: FindOptionsRelations<DbUser>,
  ): Promise<DbUser>;

  find(
    where: Array<FindOptionsWhere<DbUser>> | FindOptionsWhere<DbUser>,
    relations?: FindOptionsRelations<DbUser>,
  ): Promise<Array<DbUser>>;

  createWithWallet(args: {
    status: keyof typeof UserStatus;
    authPayload: AuthPayload;
  }): Promise<Pick<User, 'id'>>;

  create(
    status: keyof typeof UserStatus,
    entityManager: EntityManager,
    options?: { extUserId?: string; email?: EmailAddress },
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

  findOrCreateByExtUserIdAndEmail(
    extUserId: string,
    email: EmailAddress,
  ): Promise<User['id']>;

  findEmailById(userId: User['id']): Promise<EmailAddress | undefined>;

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
