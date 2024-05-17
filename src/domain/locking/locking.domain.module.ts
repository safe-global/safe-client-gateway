import { Module } from '@nestjs/common';
import { LockingApiModule } from '@/datasources/locking-api/locking-api.module';
import { ILockingRepository } from '@/domain/locking/locking.repository.interface';
import { LockingRepository } from '@/domain/locking/locking.repository';

@Module({
  imports: [LockingApiModule],
  providers: [{ provide: ILockingRepository, useClass: LockingRepository }],
  exports: [ILockingRepository],
})
// TODO: Convert to CommunityDomainModule
export class LockingDomainModule {}
