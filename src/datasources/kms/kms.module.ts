// SPDX-License-Identifier: FSL-1.1-MIT

import { Global, Module } from '@nestjs/common';
import { KmsService } from '@/datasources/kms/kms.service';

// Global so the single KmsService instance unwraps the blind-index key at
// boot and is injectable wherever needed (e.g. UsersRepository).
@Global()
@Module({
  providers: [KmsService],
  exports: [KmsService],
})
export class KmsModule {}
