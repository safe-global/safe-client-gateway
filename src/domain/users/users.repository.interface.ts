import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { User, UserStatus } from '@/domain/users/entities/user.entity';

export const IUsersRepository = Symbol('IUsersRepository');

export interface IUsersRepository {
  createUserWithWallet(args: {
    status: UserStatus;
    authPayload: AuthPayload;
  }): Promise<Pick<User, 'id'>>;

  removeWalletFromUser(args: {
    addressToRemove: `0x${string}`;
    authPayload: AuthPayload;
  }): Promise<void>;
}
