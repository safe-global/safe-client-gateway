import { Inject } from '@nestjs/common';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { UserStatus } from '@/modules/users/domain/entities/user.entity';
import { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { UsersRepository } from '@/modules/users/domain/users.repository';
import type { UserWithWallets } from '@/modules/users/routes/entities/user-with-wallets.entity';
import type { CreatedUserWithWallet } from '@/modules/users/routes/entities/created-user-with-wallet.entity';
import type { WalletAddedToUser } from '@/modules/users/routes/entities/wallet-added-to-user.entity';
import { getEnumKey } from '@/domain/common/utils/enum';
import type { SiweDto } from '@/modules/auth/routes/entities/siwe.dto.entity';
import type { Address } from 'viem';

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
    walletAddress: Address;
  }): Promise<void> {
    return await this.usersRepository.deleteWalletFromUser(args);
  }
}
