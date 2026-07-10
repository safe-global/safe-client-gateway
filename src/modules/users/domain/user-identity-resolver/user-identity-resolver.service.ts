// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

@Injectable()
export class UserIdentityResolverService {
  public static readonly DELETED_USER_LABEL = 'Deleted user';
  public static readonly UNKNOWN_USER_LABEL = 'Unknown user';

  constructor(
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
    private readonly walletEncryptionService: WalletEncryptionService,
  ) {}

  /**
   * Resolves a user-display string per user ID.
   * Order: first wallet address → email → "Unknown user".
   * IDs whose user is missing are omitted; callers should treat absence
   * as "Deleted user" (use {@link UserIdentityResolverService.DELETED_USER_LABEL}).
   */
  public async resolveMany(
    userIds: ReadonlyArray<number>,
  ): Promise<Map<number, string>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();

    const [users, wallets] = await Promise.all([
      this.usersRepository.find({ id: In(unique) }),
      this.walletsRepository.find({
        where: { user: { id: In(unique) } },
        relations: { user: true },
      }),
    ]);

    // Sort wallets by id ascending so users with multiple wallets always
    // resolve to the same display address across runs.
    const sortedWallets = [...wallets].sort((a, b) => a.id - b.id);
    const walletByUserId = new Map<number, string>();
    for (const wallet of sortedWallets) {
      if (!walletByUserId.has(wallet.user.id)) {
        // Stored addresses may be KMS ciphertext; the display value is the
        // plaintext, decrypted under the owning user's scope (only the first
        // wallet per user costs a KMS call, and the LRU cache absorbs
        // repeats).
        walletByUserId.set(
          wallet.user.id,
          await this.walletEncryptionService.decryptAddress(
            wallet.user.id,
            wallet.address,
          ),
        );
      }
    }

    return new Map(
      users.map((user): [number, string] => [
        user.id,
        walletByUserId.get(user.id) ??
          user.email ??
          UserIdentityResolverService.UNKNOWN_USER_LABEL,
      ]),
    );
  }
}
