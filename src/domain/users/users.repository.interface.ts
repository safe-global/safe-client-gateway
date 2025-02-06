import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { User, UserStatus } from '@/domain/users/entities/user.entity';
import type { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';

export const IUsersRepository = Symbol('IUsersRepository');

export interface IUsersRepository {
  createWithWallet(args: {
    status: UserStatus;
    authPayload: AuthPayload;
  }): Promise<Pick<User, 'id'>>;

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
}
