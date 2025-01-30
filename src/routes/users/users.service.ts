import { UserStatus } from '@/domain/users/entities/user.entity';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { UsersRepository } from '@/domain/users/users.repository';
import type { UserWithWallets } from '@/routes/users/entities/user-with-wallets.entity';
import type { CreatedUserWithWallet } from '@/routes/users/entities/created-user-with-wallet.entity';

export class UsersService {
  public constructor(private readonly usersRepository: UsersRepository) {}

  public async getUserWithWallets(
    authPayload: AuthPayload,
  ): Promise<UserWithWallets> {
    return await this.usersRepository.getUserWithWallets(authPayload);
  }

  public async deleteUser(authPayload: AuthPayload): Promise<void> {
    return await this.usersRepository.deleteUser(authPayload);
  }

  public async createUserWithWallet(
    authPayload: AuthPayload,
  ): Promise<CreatedUserWithWallet> {
    return await this.usersRepository.createUserWithWallet({
      status: UserStatus.ACTIVE,
      authPayload,
    });
  }

  public async deleteWalletFromUser(args: {
    authPayload: AuthPayload;
    walletAddress: `0x${string}`;
  }): Promise<void> {
    return await this.usersRepository.deleteWalletFromUser(args);
  }
}
