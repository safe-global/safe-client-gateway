import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { UsersRepository } from '@/domain/users/users.repository';
import type { UserWithWallets } from '@/routes/users/entities/user-with-wallets.entity';

export class UsersService {
  public constructor(private readonly usersRepository: UsersRepository) {}

  public async getUserWithWallet(
    authPayload: AuthPayload,
  ): Promise<UserWithWallets> {
    return await this.usersRepository.getUserWithWallets(authPayload);
  }
}
