import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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

  async getUser(authPayload: AuthPayload): Promise<{
    id: User['id'];
    status: User['status'];
    wallets: Array<{ address: Wallet['address']; id: Wallet['id'] }>;
  }> {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException();
    }

    return await this.postgresDatabaseService.transaction(
      async (entityManager: EntityManager) => {
        const walletRepository = entityManager.getRepository(Wallet);

        const authenticatedWallet = await walletRepository.findOne({
          where: { address: authPayload.signer_address },
          relations: { user: true },
        });

        if (!authenticatedWallet?.user) {
          throw new NotFoundException('User not found');
        }

        const wallets = await walletRepository.findBy({
          user: authenticatedWallet.user,
        });

        return {
          id: authenticatedWallet.user.id,
          status: authenticatedWallet.user.status,
          wallets: wallets.map((wallet) => ({
            id: wallet.id,
            address: wallet.address,
          })),
        };
      },
    );
  }

  async deleteUser(authPayload: AuthPayload): Promise<void> {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException();
    }

    await this.postgresDatabaseService.transaction(
      async (entityManager: EntityManager) => {
        const userRepository = entityManager.getRepository(DbUser);

        const deleteResult = await userRepository.delete({
          wallets: { address: authPayload.signer_address },
        });

        if (!deleteResult.affected) {
          throw new NotFoundException(
            `A user for wallet ${authPayload.signer_address} does not exist.`,
          );
        }
      },
    );
  }

  async deleteWalletFromUser(args: {
    walletAddress: `0x${string}`;
    authPayload: AuthPayload;
  }): Promise<void> {
    if (!args.authPayload.signer_address) {
      throw new UnauthorizedException();
    }

    if (args.authPayload.signer_address === args.walletAddress) {
      throw new ConflictException('Cannot remove the current wallet');
    }

    await this.postgresDatabaseService.transaction(
      async (entityManager: EntityManager) => {
        const userRepository = entityManager.getRepository(DbUser);
        const walletRepository = entityManager.getRepository(Wallet);

        const user = await userRepository.findOne({
          where: { wallets: { address: args.authPayload.signer_address } },
          relations: { wallets: true },
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        if (user.wallets.length === 1) {
          throw new BadRequestException(
            'Cannot delete the last wallet of a user',
          );
        }

        const deleteResult = await walletRepository.delete({
          address: args.walletAddress,
          user: { id: user.id },
        });

        if (!deleteResult.affected) {
          throw new NotFoundException(
            `A wallet with address ${args.walletAddress} does not exist for the current user`,
          );
        }
      },
    );
  }
}
