import { Inject } from '@nestjs/common';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { ISiweRepository } from '@/domain/siwe/siwe.repository.interface';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { UsersRepository } from '@/domain/users/users.repository';
import type { UserWithWallets } from '@/routes/users/entities/user-with-wallets.entity';
import type { CreatedUserWithWallet } from '@/routes/users/entities/created-user-with-wallet.entity';
import type { WalletAddedToUser } from '@/routes/users/entities/wallet-added-to-user.entity';
import { getEnumKey } from '@/domain/common/utils/enum';
import type { SiweDto } from '@/routes/auth/entities/siwe.dto.entity';

export class UsersService {
  public constructor(
    @Inject(IUsersRepository)
    private readonly usersRepository: UsersRepository,
    @Inject(ISiweRepository)
    private readonly siweRepository: ISiweRepository,
  ) {}

  public async createWithWallet(
    authPayload: AuthPayload,
  ): Promise<CreatedUserWithWallet> {
    return await this.usersRepository.createWithWallet({
      status: getEnumKey(UserStatus, UserStatus.ACTIVE),
      authPayload,
    });
  }

  public async getWithWallets(
    authPayload: AuthPayload,
  ): Promise<UserWithWallets> {
    return await this.usersRepository.getWithWallets(authPayload);
  }

  public async addWalletToUser(args: {
    authPayload: AuthPayload;
    siweDto: SiweDto;
  }): Promise<WalletAddedToUser> {
    const message = await this.siweRepository.getValidatedSiweMessage(
      args.siweDto,
    );

    return await this.usersRepository.addWalletToUser({
      authPayload: args.authPayload,
      walletAddress: message.address,
    });
  }

  public async delete(authPayload: AuthPayload): Promise<void> {
    return await this.usersRepository.delete(authPayload);
  }

  public async deleteWalletFromUser(args: {
    authPayload: AuthPayload;
    walletAddress: `0x${string}`;
  }): Promise<void> {
    return await this.usersRepository.deleteWalletFromUser(args);
  }
}
