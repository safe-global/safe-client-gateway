// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { FingerprintApiService } from '@/datasources/locking-api/fingerprint-api.service';
import { IIdentityApi } from '@/domain/interfaces/identity-api.interface';

@Module({
  providers: [{ provide: IIdentityApi, useClass: FingerprintApiService }],
  exports: [IIdentityApi],
})
export class IdentityApiModule {}
