// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';

@Module({
  providers: [
    {
      provide: IUsersRepository,
      useValue: {
        findOneOrFail: jest.fn(),
        createWithWallet: jest.fn(),
        create: jest.fn(),
        getWithWallets: jest.fn(),
        addWalletToUser: jest.fn(),
        delete: jest.fn(),
        deleteWalletFromUser: jest.fn(),
        findByWalletAddressOrFail: jest.fn(),
        findByWalletAddress: jest.fn(),
        // Plain functions (not jest.fn) so they survive jest.resetAllMocks()
        // in tests that call getAccessToken → findOrCreate*.
        findOrCreateByWalletAddress: (): Promise<number> => Promise.resolve(1),
        findOrCreateByExtUserId: (): Promise<number> => Promise.resolve(1),
        persistVerifiedEmail: jest.fn().mockResolvedValue(undefined),
        findEmailById: jest.fn().mockResolvedValue(undefined),
        update: jest.fn(),
        updateStatus: jest.fn(),
        activateIfPending: jest.fn(),
      },
    },
    {
      provide: IMembersRepository,
      useValue: {
        findOneOrFail: jest.fn(),
        findOne: jest.fn(),
        findOrFail: jest.fn(),
        find: jest.fn(),
        inviteUsers: jest.fn(),
        acceptInvite: jest.fn(),
        declineInvite: jest.fn(),
        findAuthorizedMembersOrFail: jest.fn(),
        findSelfMembershipOrFail: jest.fn(),
        updateRole: jest.fn(),
        updateAlias: jest.fn(),
        removeUser: jest.fn(),
        removeSelf: jest.fn(),
      },
    },
  ],
  exports: [IUsersRepository, IMembersRepository],
})
export class TestUsersModule {}
