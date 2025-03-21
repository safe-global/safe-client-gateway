import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { IUsersRepository } from '@/domain/users/users.repository.interface';
import { User, UserStatus } from '@/domain/users/entities/user.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { User as DbUser } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { EntityManager } from 'typeorm';
import { IWalletsRepository } from '@/domain/wallets/wallets.repository.interface';

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
  ): Promise<User['id']> {
    const userInsertResult = await entityManager.insert(DbUser, {
      status,
    });

    return userInsertResult.identifiers[0].id;
  }

  public async getWithWallets(authPayload: AuthPayload): Promise<{
    id: User['id'];
    status: User['status'];
    wallets: Array<Pick<Wallet, 'id' | 'address'>>;
  }> {
    this.assertSignerAddress(authPayload);

    const wallet = await this.walletsRepository.findOneByAddressOrFail(
      authPayload.signer_address,
      { user: true },
    );

    const wallets = await this.walletsRepository.findByUser(wallet.user.id, {
      address: true,
      id: true,
    });

    return {
      id: wallet.user.id,
      status: wallet.user.status,
      wallets,
    };
  }

  async addWalletToUser(args: {
    walletAddress: `0x${string}`;
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
    this.assertSignerAddress(authPayload);

    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);

    const wallet = await this.walletsRepository.findOneByAddressOrFail(
      authPayload.signer_address,
      { user: true },
    );

    await userRepository.delete({
      id: wallet.user.id,
    });
  }

  public async deleteWalletFromUser(args: {
    walletAddress: `0x${string}`;
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

  public async findByWalletAddressOrFail(
    address: `0x${string}`,
  ): Promise<User> {
    const user = await this.findByWalletAddress(address);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  public async findByWalletAddress(
    address: `0x${string}`,
  ): Promise<User | undefined> {
    const wallet = await this.walletsRepository.findOneByAddress(address, {
      user: true,
    });

    return wallet?.user;
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

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: `0x${string}` } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided');
    }
  }

  private assertWalletIsNotSigner(args: {
    authPayload: AuthPayload;
    walletAddress: `0x${string}`;
  }): void {
    if (args.authPayload.isForSigner(args.walletAddress)) {
      throw new ConflictException('Cannot remove the current wallet');
    }
  }

  private async assertWalletDoesNotExist(
    walletAddress: `0x${string}`,
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
