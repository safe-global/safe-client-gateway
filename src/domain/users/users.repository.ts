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

  async getUserWithWallets(authPayload: AuthPayload): Promise<{
    id: User['id'];
    status: User['status'];
    wallets: Array<Pick<Wallet, 'id' | 'address'>>;
  }> {
    this.assertSignerAddress(authPayload);

    const walletRepository =
      await this.postgresDatabaseService.getRepository(Wallet);

    const authenticatedWallet = await walletRepository.findOne({
      where: { address: authPayload.signer_address },
      relations: { user: true },
    });

    if (!authenticatedWallet?.user) {
      throw new NotFoundException('User not found');
    }

    const wallets = await walletRepository.find({
      select: ['id', 'address'],
      where: {
        user: authenticatedWallet.user,
      },
    });

    return {
      id: authenticatedWallet.user.id,
      status: authenticatedWallet.user.status,
      wallets,
    };
  }

  async deleteUser(authPayload: AuthPayload): Promise<void> {
    this.assertSignerAddress(authPayload);

    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);

    const deleteResult = await userRepository.delete({
      wallets: { address: authPayload.signer_address },
    });

    if (!deleteResult.affected) {
      throw new ConflictException(
        `Could not delete user. Wallet=${authPayload.signer_address}`,
      );
    }
  }

  async deleteWalletFromUser(args: {
    walletAddress: `0x${string}`;
    authPayload: AuthPayload;
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    if (args.authPayload.isForSigner(args.walletAddress)) {
      throw new ConflictException('Cannot remove the current wallet');
    }

    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);
    const walletRepository =
      await this.postgresDatabaseService.getRepository(Wallet);

    const user = await userRepository.findOne({
      where: { wallets: { address: args.authPayload.signer_address } },
      relations: { wallets: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.wallets.length === 1) {
      throw new BadRequestException('Cannot delete the last wallet of a user');
    }

    const deleteResult = await walletRepository.delete({
      address: args.walletAddress,
      user: { id: user.id },
    });

    if (!deleteResult.affected) {
      throw new ConflictException(
        `User could not be removed from wallet. Wallet=${args.walletAddress}`,
      );
    }
  }

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: `0x${string}` } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException();
    }
  }
}
