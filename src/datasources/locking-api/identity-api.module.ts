import { FingerprintApiService } from '@/datasources/locking-api/fingerprint-api.service';
import { IIdentityApi } from '@/domain/interfaces/identity-api.interface';
import { Module } from '@nestjs/common';

@Module({
  providers: [{ provide: IIdentityApi, useClass: FingerprintApiService }],
  exports: [IIdentityApi],
})
export class IdentityApiModule {}
