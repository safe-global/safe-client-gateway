import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { UserStatus } from '@/domain/users/entities/user.entity';
import type { Wallet } from '@/domain/users/entities/wallet.entity';
import type { User } from '@/domain/users/entities/user.entity';

export const IUsersRepository = Symbol('IUsersRepository');

export interface IUsersRepository {
  createUserWithWallet(args: {
    status: UserStatus;
    authPayload: AuthPayload;
  }): Promise<Pick<User, 'id'>>;

  addWalletToUser(args: {
    newSignerAddress: `0x${string}`;
    authPayload: AuthPayload;
  }): Promise<Pick<Wallet, 'id'>>;
}
