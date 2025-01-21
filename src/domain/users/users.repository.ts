import { Injectable } from '@nestjs/common';
import type { IUsersRepository } from '@/domain/users/users.repository.interface';
import {
  User as DomainUser,
  UserStatus,
} from '@/domain/users/entities/user.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/users/entities/wallets.entity.db';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  createUserWithWallet(args: {
    status: UserStatus;
    authPayload: AuthPayload;
  }): Promise<DomainUser> {
    return this.postgresDatabaseService.transaction(async (entityManager) => {
      const userRepository = entityManager.getRepository(User);
      const walletRepository = entityManager.getRepository(Wallet);

      const user = userRepository.create({
        status: args.status,
      });

      const createdUser = await userRepository.save(user);

      const wallet = walletRepository.create({
        user: createdUser,
        address: args.authPayload.signer_address,
      });

      await walletRepository.save(wallet);

      return createdUser;
    });
  }
}
