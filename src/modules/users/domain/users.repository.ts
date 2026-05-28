// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { EntityManager } from 'typeorm';
import type { Address } from 'viem';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { UserStatus } from '@/modules/users/domain/entities/user.entity';
import { UserEmailAlreadyInUseError } from '@/modules/users/domain/errors/user-email-already-in-use.error';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import type { EmailAddress } from '@/validation/entities/schemas/email-address.schema';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
  ) {}

  public async findOneOrFail(
    where: Array<FindOptionsWhere<DbUser>> | FindOptionsWhere<DbUser>,
    relations?: FindOptionsRelations<DbUser>,
  ): Promise<DbUser> {
    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);
    const user = await userRepository.findOne({ where, relations });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  public async find(
    where: Array<FindOptionsWhere<DbUser>> | FindOptionsWhere<DbUser>,
    relations?: FindOptionsRelations<DbUser>,
  ): Promise<Array<DbUser>> {
    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);
    return userRepository.find({ where, relations });
  }

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
    options?: { extUserId?: string; email?: EmailAddress },
  ): Promise<User['id']> {
    const userInsertResult = await entityManager.insert(DbUser, {
      status,
      ...(options?.extUserId && { extUserId: options.extUserId }),
      ...(options?.email && { email: options.email }),
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

  /**
   * Finds or creates an OIDC user identified by their external user ID.
   *
   * If a user with the given `extUserId` already exists, their email is
   * reconciled against `email`: a missing email is persisted, while a
   * conflicting one is rejected. Otherwise a new user is created with the
   * email stored at insert time.
   *
   * @param extUserId - The external (OIDC provider) user identifier.
   * @param email - The verified email address to associate with the user.
   * @returns The ID of the existing or newly created user.
   * @throws {UnauthorizedException} If the email does not match the one
   * already registered for the account.
   * @throws {UserEmailAlreadyInUseError} If the email is already in use by
   * another user.
   */
  public async findOrCreateByExtUserIdAndEmail(
    extUserId: string,
    email: EmailAddress,
  ): Promise<User['id']> {
    const existing = await this.findByExtUserId(extUserId);
    if (existing) {
      return this.reconcileEmail(existing, email);
    }

    try {
      return await this.postgresDatabaseService.transaction(
        async (entityManager) => {
          return await this.create('ACTIVE', entityManager, {
            extUserId,
            email,
          });
        },
      );
    } catch (error) {
      if (this.isUniqueConstraintViolation(error, 'idx_users_ext_user_id')) {
        // A concurrent request inserted this extUserId between our find and
        // insert. Re-fetch and reconcile through the same path as a user that
        // already existed, so the email is matched/backfilled/rejected
        // identically regardless of timing.
        const raced = await this.findByExtUserId(extUserId);
        if (!raced) {
          throw error;
        }
        return this.reconcileEmail(raced, email);
      }
      if (this.isUniqueConstraintViolation(error, 'idx_users_email')) {
        throw new UserEmailAlreadyInUseError();
      }
      throw error;
    }
  }

  private async findByExtUserId(
    extUserId: string,
  ): Promise<Pick<DbUser, 'id' | 'email'> | null> {
    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);

    return userRepository.findOne({
      where: { extUserId },
      select: { id: true, email: true },
    });
  }

  /**
   * Reconciles a verified `email` against an existing user: returns the id when
   * the email matches, backfills it when none is stored, and rejects a
   * conflicting one.
   */
  private async reconcileEmail(
    user: Pick<DbUser, 'id' | 'email'>,
    email: EmailAddress,
  ): Promise<User['id']> {
    if (user.email) {
      if (user.email !== email) {
        throw new UnauthorizedException(
          'Email does not match the registered email for this account',
        );
      }
      return user.id;
    }

    // No email stored yet — backfill it.
    await this.persistEmail(user.id, email);
    return user.id;
  }

  private async persistEmail(
    userId: User['id'],
    email: EmailAddress,
  ): Promise<void> {
    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);

    try {
      await userRepository
        .createQueryBuilder()
        .update(DbUser)
        .set({ email })
        .where('id = :userId', { userId })
        .andWhere('email IS NULL')
        .execute();
    } catch (error) {
      if (this.isUniqueConstraintViolation(error, 'idx_users_email')) {
        throw new UserEmailAlreadyInUseError();
      }
      throw error;
    }
  }

  public async findEmailById(
    userId: User['id'],
  ): Promise<EmailAddress | undefined> {
    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);
    const user = await userRepository.findOne({
      where: { id: userId },
      select: { email: true },
    });

    // /me omits absent email fields, so normalize null/missing rows to undefined.
    return user?.email ?? undefined;
  }

  private isUniqueConstraintViolation(
    error: unknown,
    constraint: string,
  ): boolean {
    return (
      isUniqueConstraintError(error) &&
      'constraint' in error.driverError &&
      error.driverError.constraint === constraint
    );
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
