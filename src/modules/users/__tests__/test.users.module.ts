import { Module } from '@nestjs/common';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';

@Module({
  providers: [
    {
      provide: IUsersRepository,
      useValue: {
        findOrCreateByWalletAddress: (): Promise<number> => Promise.resolve(1),
      },
    },
    {
      provide: IMembersRepository,
      useValue: {},
    },
  ],
  exports: [IUsersRepository, IMembersRepository],
})
export class TestUsersModule {}
