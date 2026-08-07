// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import { KmsModule } from '@/datasources/kms/kms.module';
import { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';

// Nest dedupes module instances, so every importer shares the single
// KmsEncryptionService whose onModuleInit unwraps the blind-index key at boot.
@Module({
  imports: [KmsModule],
  providers: [KmsEncryptionService],
  exports: [KmsEncryptionService],
})
export class KmsEncryptionModule {}
