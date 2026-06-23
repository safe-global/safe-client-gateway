// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';

@Module({
  providers: [
    {
      provide: IUsersRepository,
      useValue: {
        findOneOrFail: vi.fn(),
        createWithWallet: vi.fn(),
        create: vi.fn(),
        getWithWallets: vi.fn(),
        addWalletToUser: vi.fn(),
        delete: vi.fn(),
        deleteWalletFromUser: vi.fn(),
        findByWalletAddressOrFail: vi.fn(),
        findByWalletAddress: vi.fn(),
        // Plain functions (not vi.fn) so they survive vi.resetAllMocks()
        // in tests that call getAccessToken → findOrCreate*.
        findOrCreateByWalletAddress: (): Promise<number> => Promise.resolve(1),
        findOrCreateByExtUserIdAndEmail: (): Promise<number> =>
          Promise.resolve(1),
        findEmailById: vi.fn(),
        findEmailsByIds: vi.fn(),
        update: vi.fn(),
        updateStatus: vi.fn(),
        activateIfPending: vi.fn(),
      },
    },
    {
      provide: IMembersRepository,
      useValue: {
        findOneOrFail: vi.fn(),
        findOne: vi.fn(),
        findOrFail: vi.fn(),
        find: vi.fn(),
        inviteUsers: vi.fn(),
        acceptInvite: vi.fn(),
        declineInvite: vi.fn(),
        findAuthorizedMembersOrFail: vi.fn(),
        findSelfMembershipOrFail: vi.fn(),
        updateRole: vi.fn(),
        updateAlias: vi.fn(),
        removeUser: vi.fn(),
        removeSelf: vi.fn(),
      },
    },
  ],
  exports: [IUsersRepository, IMembersRepository],
})
export class TestUsersModule {}
