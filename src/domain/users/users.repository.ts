import { ConflictException, Injectable } from '@nestjs/common';
import type { IUsersRepository } from '@/domain/users/users.repository.interface';
import { User, UserStatus } from '@/domain/users/entities/user.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { User as DbUser } from '@/datasources/users/entities/users.entity.db';
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
  }): Promise<Pick<User, 'id'>> {
    return this.postgresDatabaseService.transaction(
      async (entityManager: EntityManager) => {
        const userRepository = entityManager.getRepository(DbUser);
        const walletRepository = entityManager.getRepository(Wallet);

        const existingWallet = await walletRepository.findOne({
          where: { address: args.authPayload.signer_address },
        });

        if (existingWallet)
          throw new ConflictException(
            'A wallet with the same address already exists',
          );

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

  async addWalletToUser(args: {
    newSignerAddress: `0x${string}`;
    authPayload: AuthPayload;
  }): Promise<Pick<Wallet, 'id'>> {
    return await this.postgresDatabaseService.transaction(
      async (entityManager: EntityManager) => {
        const walletRepository = entityManager.getRepository(Wallet);

        // Find existing wallet with auth signer address to get the user
        const authenticatedWallet = await walletRepository.findOne({
          where: { address: args.authPayload.signer_address },
          relations: { user: true },
        });

        if (!authenticatedWallet?.user) {
          throw new Error('User not found');
        }

        // Check if new wallet address already exists
        const existingNewWallet = await walletRepository.findOne({
          where: { address: args.newSignerAddress },
        });

        if (existingNewWallet) {
          throw new ConflictException(
            'A wallet with the same address already exists',
          );
        }

        // Create new wallet entry linked to the user
        const walletInsertResult = await walletRepository.insert({
          user: authenticatedWallet.user,
          address: args.newSignerAddress,
        });

        return { id: walletInsertResult.identifiers[0].id };
      },
    );
  }
}
