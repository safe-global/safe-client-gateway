import { Module } from '@nestjs/common';
import { LockingApiModule } from '@/datasources/locking-api/locking-api.module';
import { ILockingRepository } from '@/domain/locking/locking.repository.interface';
import { LockingRepository } from '@/domain/locking/locking.repository';
import { LockingEventValidator } from '@/domain/locking/locking-event.validator';
import { RankValidator } from '@/domain/locking/rank.validator';

@Module({
  imports: [LockingApiModule],
  providers: [
    { provide: ILockingRepository, useClass: LockingRepository },
    LockingEventValidator,
    RankValidator,
  ],
  exports: [ILockingRepository],
})
export class LockingDomainModule {}
