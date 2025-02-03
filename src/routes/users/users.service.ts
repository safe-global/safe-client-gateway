import { Inject } from '@nestjs/common';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { UserStatus } from '@/domain/users/entities/user.entity';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { UsersRepository } from '@/domain/users/users.repository';
import type { UserWithWallets } from '@/routes/users/entities/user-with-wallets.entity';
import type { CreatedUserWithWallet } from '@/routes/users/entities/created-user-with-wallet.entity';

export class UsersService {
  public constructor(
    @Inject(IUsersRepository)
    private readonly usersRepository: UsersRepository,
  ) {}

  public async getWithWallets(
    authPayload: AuthPayload,
  ): Promise<UserWithWallets> {
    return await this.usersRepository.getWithWallets(authPayload);
  }

  public async delete(authPayload: AuthPayload): Promise<void> {
    return await this.usersRepository.delete(authPayload);
  }

  public async createWithWallet(
    authPayload: AuthPayload,
  ): Promise<CreatedUserWithWallet> {
    return await this.usersRepository.createWithWallet({
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
