// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { User, UserStatus } from '@/modules/users/domain/entities/user.entity';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { EntityManager } from 'typeorm';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import type { Address } from 'viem';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
  ) {}

  public async createWithWallet(args: {
    status: keyof typeof UserStatus;
    authPayload: AuthPayload;
  }): Promise<Pick<User, 'id'>> {
    this.assertSignerAddress(args.authPayload);
    await this.assertWalletDoesNotExist(args.authPayload.signer_address);

    const walletAddress = args.authPayload.signer_address;

    return this.postgresDatabaseService.transaction(
      async (entityManager: EntityManager) => {
        const userId = await this.create(args.status, entityManager);

        await this.walletsRepository.create(
          {
            userId,
            walletAddress,
          },
          entityManager,
        );

        return { id: userId };
      },
    );
  }

  public async create(
    status: keyof typeof UserStatus,
    entityManager: EntityManager,
    options?: { extUserId?: string },
  ): Promise<User['id']> {
    const userInsertResult = await entityManager.insert(DbUser, {
      status,
      ...(options?.extUserId && { extUserId: options.extUserId }),
    });

    return userInsertResult.identifiers[0].id;
  }

  public async getWithWallets(authPayload: AuthPayload): Promise<{
    id: User['id'];
    status: User['status'];
    wallets: Array<Pick<Wallet, 'id' | 'address'>>;
  }> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);

    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const wallets = await this.walletsRepository.findByUser(userId, {
      address: true,
      id: true,
    });

    return {
      id: user.id,
      status: user.status,
      wallets,
    };
  }

  async addWalletToUser(args: {
    walletAddress: Address;
    authPayload: AuthPayload;
  }): Promise<Pick<Wallet, 'id'>> {
    this.assertSignerAddress(args.authPayload);
    await this.assertWalletDoesNotExist(args.walletAddress);

    const user = await this.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    // @todo: We should improve the transaction handling here
    return this.postgresDatabaseService.transaction(
      async (entityManager: EntityManager) => {
        const walletInsertResult = await this.walletsRepository.create(
          {
            userId: user.id,
            walletAddress: args.walletAddress,
          },
          entityManager,
        );
        return { id: walletInsertResult.identifiers[0].id };
      },
    );
  }

  public async delete(authPayload: AuthPayload): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);

    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);

    await userRepository.delete({ id: userId });
  }

  public async deleteWalletFromUser(args: {
    walletAddress: Address;
    authPayload: AuthPayload;
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);
    this.assertWalletIsNotSigner(args);

    const user = await this.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    const wallet = await this.walletsRepository.findOneOrFail({
      address: args.walletAddress,
      user: { id: user.id },
    });

    await this.walletsRepository.deleteByAddress(wallet.address);
  }

  public async findByWalletAddressOrFail(address: Address): Promise<User> {
    const user = await this.findByWalletAddress(address);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  public async findByWalletAddress(
    address: Address,
  ): Promise<User | undefined> {
    const wallet = await this.walletsRepository.findOneByAddress(address, {
      user: true,
    });

    return wallet?.user;
  }

  public async findOrCreateByWalletAddress(
    address: Address,
  ): Promise<User['id']> {
    const existing = await this.findByWalletAddress(address);
    if (existing) {
      return existing.id;
    }

    try {
      return await this.postgresDatabaseService.transaction(
        async (entityManager: EntityManager) => {
          const userId = await this.create('ACTIVE', entityManager);

          await this.walletsRepository.create(
            { userId, walletAddress: address },
            entityManager,
          );

          return userId;
        },
      );
    } catch (error) {
      // Handle race condition: a concurrent call may have created the
      // wallet between our find and insert, causing a unique constraint
      // violation. Retry the lookup in that case.
      if (
        error instanceof Error &&
        error.message.includes('UQ_wallet_address')
      ) {
        const user = await this.findByWalletAddressOrFail(address);
        return user.id;
      }
      throw error;
    }
  }

  public async findOrCreateByExtUserId(extUserId: string): Promise<User['id']> {
    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);

    const existing = await userRepository.findOne({
      where: { extUserId },
    });
    if (existing) {
      return existing.id;
    }

    try {
      return await this.postgresDatabaseService.transaction(
        async (entityManager: EntityManager) => {
          return await this.create('ACTIVE', entityManager, { extUserId });
        },
      );
    } catch (error) {
      // Handle race condition: a concurrent call may have created the
      // user between our find and insert, causing a unique constraint
      // violation. Retry the lookup in that case.
      if (
        error instanceof Error &&
        error.message.includes('idx_users_ext_user_id')
      ) {
        const user = await userRepository.findOneOrFail({
          where: { extUserId },
        });
        return user.id;
      }
      throw error;
    }
  }

  public async update(args: {
    userId: User['id'];
    user: Partial<User>;
    entityManager: EntityManager;
  }): Promise<void> {
    await args.entityManager.update(DbUser, args.user.id, args.user);
  }

  public async updateStatus(args: {
    userId: User['id'];
    status: User['status'];
    entityManager: EntityManager;
  }): Promise<void> {
    await this.update({
      userId: args.userId,
      user: {
        id: args.userId,
        status: args.status,
      },
      entityManager: args.entityManager,
    });
  }

  public async activateIfPending(userId: User['id']): Promise<void> {
    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);
    await userRepository.update(
      { id: userId, status: 'PENDING' },
      { status: 'ACTIVE' },
    );
  }

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: Address } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided');
    }
  }

  private assertWalletIsNotSigner(args: {
    authPayload: AuthPayload;
    walletAddress: Address;
  }): void {
    if (args.authPayload.isForSigner(args.walletAddress)) {
      throw new ConflictException('Cannot remove the current wallet');
    }
  }

  private async assertWalletDoesNotExist(
    walletAddress: Address,
  ): Promise<void> {
    const wallet = await this.walletsRepository.findOneByAddress(walletAddress);

    if (wallet) {
      throw new ConflictException(
        'A wallet with the same address already exists. Wallet=' +
          walletAddress,
      );
    }
  }
}
