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
import { EntityManager } from 'typeorm';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  createUserWithWallet(args: {
    status: UserStatus;
    authPayload: AuthPayload;
  }): Promise<Pick<DomainUser, 'id'>> {
    return this.postgresDatabaseService.transaction(
      async (entityManager: EntityManager) => {
        const userRepository = entityManager.getRepository(User);
        const walletRepository = entityManager.getRepository(Wallet);

        const user = userRepository.create({
          status: args.status,
        });

        const userInsertResult = await userRepository.insert(user);

        await walletRepository.insert({
          user: user,
          address: args.authPayload.signer_address,
        });

        return { id: userInsertResult.identifiers[0].id };
      },
    );
  }
}
