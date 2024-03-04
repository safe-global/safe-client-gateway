import { Module } from '@nestjs/common';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import { LockingApi } from '@/datasources/locking-api/locking-api.service';

@Module({
  providers: [{ provide: ILockingApi, useClass: LockingApi }],
  exports: [ILockingApi],
})
export class LockingApiModule {}
