// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';
import { UserIdentityResolverService } from '@/modules/users/domain/user-identity-resolver/user-identity-resolver.service';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { Wallet as DbWallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { createMockWalletEncryptionService } from '@/modules/wallets/domain/__tests__/wallet-encryption.service.mock';
import type { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

const mockUsersRepository = vi.mocked({
  find: vi.fn(),
} as unknown as IUsersRepository);

const mockWalletsRepository = vi.mocked({
  find: vi.fn(),
} as unknown as IWalletsRepository);

const buildUser = (overrides: Partial<DbUser>): DbUser =>
  ({
    id: 0,
    email: null,
    ...overrides,
  }) as DbUser;

const buildWallet = (overrides: Partial<DbWallet>): DbWallet =>
  ({
    id: 0,
    ...overrides,
  }) as DbWallet;

describe('UserIdentityResolverService', () => {
  let service: UserIdentityResolverService;
  let walletEncryptionService: MockedObject<WalletEncryptionService>;

  beforeEach(() => {
    vi.clearAllMocks();
    walletEncryptionService = createMockWalletEncryptionService();
    service = new UserIdentityResolverService(
      mockUsersRepository,
      mockWalletsRepository,
      walletEncryptionService,
    );
  });

  it('returns an empty map for empty input', async () => {
    const result = await service.resolveMany([]);
    expect(result.size).toBe(0);
    expect(mockUsersRepository.find).not.toHaveBeenCalled();
  });

  it('prefers wallet address when present', async () => {
    const wallet = getAddress(faker.finance.ethereumAddress());
    mockUsersRepository.find.mockResolvedValue([
      buildUser({ id: 1, email: fakeEmailAddress() }),
    ]);
    mockWalletsRepository.find.mockResolvedValue([
      buildWallet({ user: buildUser({ id: 1 }), address: wallet }),
    ]);

    const result = await service.resolveMany([1]);
    expect(result.get(1)).toBe(wallet);
  });

  it('falls back to email when no wallet', async () => {
    const email = fakeEmailAddress();
    mockUsersRepository.find.mockResolvedValue([buildUser({ id: 2, email })]);
    mockWalletsRepository.find.mockResolvedValue([]);

    const result = await service.resolveMany([2]);
    expect(result.get(2)).toBe(email);
  });

  it('returns "Unknown user" when no wallet and no email', async () => {
    mockUsersRepository.find.mockResolvedValue([
      buildUser({ id: 3, email: null }),
    ]);
    mockWalletsRepository.find.mockResolvedValue([]);

    const result = await service.resolveMany([3]);
    expect(result.get(3)).toBe('Unknown user');
  });

  it('picks the lowest-id wallet when a user has multiple', async () => {
    const earlierWallet = getAddress(faker.finance.ethereumAddress());
    const laterWallet = getAddress(faker.finance.ethereumAddress());
    mockUsersRepository.find.mockResolvedValue([
      buildUser({ id: 7, email: null }),
    ]);
    // Return wallets in the "wrong" order to verify the resolver sorts them.
    mockWalletsRepository.find.mockResolvedValue([
      buildWallet({ id: 20, user: buildUser({ id: 7 }), address: laterWallet }),
      buildWallet({
        id: 5,
        user: buildUser({ id: 7 }),
        address: earlierWallet,
      }),
    ]);

    const result = await service.resolveMany([7]);
    expect(result.get(7)).toBe(earlierWallet);
  });

  it('decrypts an encrypted wallet address via the owning user id', async () => {
    const plaintext = getAddress(faker.finance.ethereumAddress());
    mockUsersRepository.find.mockResolvedValue([
      buildUser({ id: 4, email: null }),
    ]);
    mockWalletsRepository.find.mockResolvedValue([
      buildWallet({
        id: 1,
        user: buildUser({ id: 4 }),
        address: 'kms:v1:ciphertext',
      }),
    ]);
    walletEncryptionService.decryptAddress.mockResolvedValue(plaintext);

    const result = await service.resolveMany([4]);

    expect(walletEncryptionService.decryptAddress).toHaveBeenCalledWith(
      4,
      'kms:v1:ciphertext',
    );
    expect(result.get(4)).toBe(plaintext);
  });
  it('omits user IDs whose user no longer exists', async () => {
    mockUsersRepository.find.mockResolvedValue([]);
    mockWalletsRepository.find.mockResolvedValue([]);

    const result = await service.resolveMany([99]);
    expect(result.has(99)).toBe(false);
  });

  it('exposes label constants', () => {
    expect(UserIdentityResolverService.UNKNOWN_USER_LABEL).toBe('Unknown user');
    expect(UserIdentityResolverService.DELETED_USER_LABEL).toBe('Deleted user');
  });
});
