import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { User, UserStatus } from '@/domain/users/entities/user.entity';
import type { Wallet } from '@/datasources/users/entities/wallets.entity.db';

export const IUsersRepository = Symbol('IUsersRepository');

export interface IUsersRepository {
  createUserWithWallet(args: {
    status: UserStatus;
    authPayload: AuthPayload;
  }): Promise<Pick<User, 'id'>>;

  getUser(authPayload: AuthPayload): Promise<{
    id: User['id'];
    status: User['status'];
    wallets: Array<{ address: Wallet['address']; id: Wallet['id'] }>;
  }>;

  deleteUser(authPayload: AuthPayload): Promise<void>;

  deleteWallet(args: {
    walletAddress: `0x${string}`;
    authPayload: AuthPayload;
  }): Promise<void>;

  removeWalletFromUser(args: {
    addressToRemove: `0x${string}`;
    authPayload: AuthPayload;
  }): Promise<void>;
}
