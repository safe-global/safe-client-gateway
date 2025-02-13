import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { User, UserStatus } from '@/domain/users/entities/user.entity';
import type { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import type { EntityManager } from 'typeorm';

export const IUsersRepository = Symbol('IUsersRepository');

export interface IUsersRepository {
  createWithWallet(args: {
    status: keyof typeof UserStatus;
    authPayload: AuthPayload;
  }): Promise<Pick<User, 'id'>>;

  create(
    status: keyof typeof UserStatus,
    entityManager: EntityManager,
  ): Promise<User['id']>;

  getWithWallets(authPayload: AuthPayload): Promise<{
    id: User['id'];
    status: User['status'];
    wallets: Array<Pick<Wallet, 'address' | 'id'>>;
  }>;

  addWalletToUser(args: {
    walletAddress: `0x${string}`;
    authPayload: AuthPayload;
  }): Promise<Pick<Wallet, 'id'>>;

  delete(authPayload: AuthPayload): Promise<void>;

  deleteWalletFromUser(args: {
    walletAddress: `0x${string}`;
    authPayload: AuthPayload;
  }): Promise<void>;

  findByWalletAddressOrFail(address: `0x${string}`): Promise<User>;

  findByWalletAddress(address: `0x${string}`): Promise<User | undefined>;

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
}
