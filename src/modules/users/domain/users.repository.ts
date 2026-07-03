// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { EntityManager, In, IsNull } from 'typeorm';
import type { Address } from 'viem';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import { Member as DbMember } from '@/modules/users/datasources/entities/member.entity.db';
import { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';
import { EmailEncryptionService } from '@/modules/users/domain/email-encryption.service';
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
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
    private readonly emailEncryptionService: EmailEncryptionService,
  ) {}

  /**
   * Returns copies of loaded users with their `email` values decrypted (one
   * KMS call per encrypted value). With encryption enabled a plaintext value
   * throws; when disabled, plaintext passes through.
   */
  private async decryptUserEmails(
    users: Array<DbUser>,
  ): Promise<Array<DbUser>> {
    return await this.emailEncryptionService.decryptUserEmails(users);
  }

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

    const [decryptedUser] = await this.decryptUserEmails([user]);
    return decryptedUser;
  }

  public async find(
    where: Array<FindOptionsWhere<DbUser>> | FindOptionsWhere<DbUser>,
    relations?: FindOptionsRelations<DbUser>,
  ): Promise<Array<DbUser>> {
    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);
    const users = await userRepository.find({ where, relations });
    return await this.decryptUserEmails(users);
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
    const email = options?.email;
    // When enabled, the blind index enforces uniqueness at insert (the email
    // value is set once the id is known, below); when disabled, the plaintext
    // email is stored directly.
    const emailIndex = email
      ? this.emailEncryptionService.blindIndex(email)
      : null;
    let emailColumns: { emailIndex?: string; email?: EmailAddress } = {};
    if (emailIndex) {
      emailColumns = { emailIndex };
    } else if (email) {
      emailColumns = { email };
    }

    const userInsertResult = await entityManager.insert(DbUser, {
      status,
      ...(options?.extUserId && { extUserId: options.extUserId }),
      ...emailColumns,
    });
    const userId = userInsertResult.identifiers[0].id;

    if (email && emailIndex) {
      await entityManager.update(DbUser, userId, {
        email: (await this.emailEncryptionService.encrypt(
          userId,
          email,
        )) as EmailAddress,
      });
    }

    return userId;
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

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const memberships = await entityManager.find(DbMember, {
        where: { user: { id: userId } },
        relations: { space: true },
      });

      for (const membership of memberships) {
        // Only ACTIVE members "leave" — pending/declined invites just expire.
        if (membership.status !== 'ACTIVE') {
          continue;
        }
        await this.spaceAuditRepository.record(entityManager, {
          spaceId: membership.space.id,
          spaceUuid: membership.space.uuid,
          eventType: SpaceAuditEventType.MEMBER_LEFT,
          actorUserId: userId,
          payload: { targetUserId: userId, accountDeleted: true },
        });
      }

      await entityManager.delete(DbUser, { id: userId });
    });
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

    if (!wallet) {
      return undefined;
    }
    const [decryptedUser] = await this.decryptUserEmails([wallet.user]);
    return decryptedUser;
  }

  public findOrCreateByWalletAddress(
    address: Address,
    status: keyof typeof UserStatus = 'ACTIVE',
    entityManager?: EntityManager,
  ): Promise<User['id']> {
    const findOrCreate = async (
      manager: EntityManager,
    ): Promise<User['id']> => {
      const existing = await manager.findOne(Wallet, {
        where: { address },
        relations: { user: true },
      });
      if (existing) {
        return existing.user.id;
      }

      // `status` only applies when creating a user for a new wallet.
      const userId = await this.create(status, manager);
      const insert = await manager
        .createQueryBuilder()
        .insert()
        .into(Wallet)
        .values({ user: { id: userId }, address })
        .orIgnore()
        .execute();

      if (insert.identifiers.length > 0) {
        return userId;
      }

      await manager.delete(DbUser, userId);
      const raced = await manager.findOne(Wallet, {
        where: { address },
        relations: { user: true },
      });
      if (!raced) {
        throw new NotFoundException(`Wallet not found. Address=${address}`);
      }
      return raced.user.id;
    };

    if (entityManager) {
      return findOrCreate(entityManager);
    }

    return this.postgresDatabaseService.transaction(findOrCreate);
  }

  /**
   * Returns the id of an existing user with this email, or creates and
   * returns a PENDING placeholder. Idempotent — repeated calls with the
   * same email yield the same id.
   *
   * Used by the email-invite path: the placeholder will be claimed by the
   * eventual OIDC sign-in via {@link findOrCreateByExtUserIdAndEmail}.
   */
  public findOrCreateByEmail(
    email: EmailAddress,
    entityManager?: EntityManager,
  ): Promise<User['id']> {
    const upsertThenSelect = async (
      manager: EntityManager,
    ): Promise<User['id']> => {
      const emailIndex = this.emailEncryptionService.blindIndex(email);

      await manager
        .createQueryBuilder()
        .insert()
        .into(DbUser)
        .values({
          status: 'PENDING',
          ...(emailIndex ? { emailIndex } : { email }),
        })
        .orIgnore()
        .execute();

      // Look up by blind index when enabled, by plaintext value when disabled.
      const user = await manager.findOneOrFail(DbUser, {
        where: emailIndex ? { emailIndex } : { email },
        select: { id: true, email: true },
      });

      // Newly inserted under encryption: the value column is still null, so
      // set the encrypted email now that the id is known.
      if (emailIndex && !user.email) {
        await manager.update(DbUser, user.id, {
          email: (await this.emailEncryptionService.encrypt(
            user.id,
            email,
          )) as EmailAddress,
        });
      }
      return user.id;
    };

    if (entityManager) {
      return upsertThenSelect(entityManager);
    }
    return this.postgresDatabaseService.transaction(upsertThenSelect);
  }

  /**
   * Finds or creates an OIDC user identified by their external user ID.
   *
   * Resolution order:
   *  1. existing user with this `extUserId` → reconcile email
   *  2. PENDING placeholder created by a prior email invite → claim by
   *     setting `extUserId` and flipping to ACTIVE
   *  3. otherwise INSERT a fresh ACTIVE user with email at insert time
   *
   * @param extUserId - The external (OIDC provider) user identifier.
   * @param email - The verified email address to associate with the user.
   * @returns The ID of the existing, claimed, or newly created user.
   * @throws {UnauthorizedException} If the email does not match the one
   * already registered for the account.
   * @throws {UserEmailAlreadyInUseError} If the email is already in use by
   * another user.
   */
  public async findOrCreateByExtUserIdAndEmail(
    extUserId: string,
    email: EmailAddress,
  ): Promise<User['id']> {
    // This lookup/claim/insert sequence relies on unique indexes to settle
    // races instead of SERIALIZABLE isolation; see the catches below.
    const existing = await this.findByExtUserId(extUserId);
    if (existing) {
      return this.reconcileEmail(existing, email);
    }

    const claimed = await this.claimPendingByEmail(extUserId, email);
    if (claimed !== null) {
      return claimed;
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
      if (this.isUniqueConstraintViolation(error, 'idx_users_email_index')) {
        throw new UserEmailAlreadyInUseError();
      }
      throw error;
    }
  }

  /**
   * Atomically claims a PENDING email-invite placeholder for this OIDC
   * caller. Returns the claimed user id, or null if no matching
   * placeholder exists (caller should fall through to INSERT). Throws
   * {@link UserEmailAlreadyInUseError} when a user with this email exists
   * but isn't a claimable placeholder (already ACTIVE, or already linked
   * to a different extUserId).
   */
  private async claimPendingByEmail(
    extUserId: string,
    email: EmailAddress,
  ): Promise<User['id'] | null> {
    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);
    const emailIndex = this.emailEncryptionService.blindIndex(email);
    const candidate = await userRepository.findOne({
      where: emailIndex ? { emailIndex } : { email },
      select: { id: true, status: true, extUserId: true },
    });

    if (!candidate) {
      return null;
    }

    if (candidate.status !== 'PENDING' || candidate.extUserId !== null) {
      throw new UserEmailAlreadyInUseError();
    }

    const result = await userRepository.update(
      { id: candidate.id, status: 'PENDING', extUserId: IsNull() },
      { extUserId, status: 'ACTIVE' },
    );

    return result.affected === 1 ? candidate.id : null;
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
      // Stored email is KMS ciphertext bound to this user; compare plaintext.
      const storedEmail = await this.emailEncryptionService.decrypt(
        user.id,
        user.email,
      );
      if (storedEmail !== email) {
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

    const emailIndex = this.emailEncryptionService.blindIndex(email);
    const emailValue = emailIndex
      ? await this.emailEncryptionService.encrypt(userId, email)
      : email;

    try {
      await userRepository
        .createQueryBuilder()
        .update(DbUser)
        .set({
          email: emailValue as EmailAddress,
          ...(emailIndex && { emailIndex }),
        })
        .where('id = :userId', { userId })
        .andWhere('email IS NULL')
        .execute();
    } catch (error) {
      if (this.isUniqueConstraintViolation(error, 'idx_users_email_index')) {
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
      select: { id: true, email: true },
    });

    if (!user?.email) {
      // /me omits absent email fields, so normalize null/missing to undefined.
      return undefined;
    }
    const [decryptedUser] = await this.decryptUserEmails([user]);
    return decryptedUser.email ?? undefined;
  }

  public async findEmailsByIds(
    userIds: Array<User['id']>,
  ): Promise<Map<User['id'], string> | null> {
    if (!userIds.length) return null;
    const userRepository =
      await this.postgresDatabaseService.getRepository(DbUser);
    const users = await userRepository.find({
      where: { id: In(userIds) },
      select: { id: true, email: true },
    });

    const decryptedUsers = await this.decryptUserEmails(users);

    return new Map(
      decryptedUsers.flatMap(
        (user): Array<[User['id'], string]> =>
          user.email ? [[user.id, user.email]] : [],
      ),
    );
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
