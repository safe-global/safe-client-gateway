import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { LockingApi } from '@/datasources/locking-api/locking-api.service';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';

@Module({
  providers: [HttpErrorFactory, { provide: ILockingApi, useClass: LockingApi }],
  exports: [ILockingApi],
})
export class LockingApiModule {}
