// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import { FieldCryptoService } from '@/datasources/kms/field-crypto.service';
import { KmsModule } from '@/datasources/kms/kms.module';

// Nest dedupes module instances, so every importer shares the single
// FieldCryptoService whose onModuleInit unwraps the blind-index key at boot.
@Module({
  imports: [KmsModule],
  providers: [FieldCryptoService],
  exports: [FieldCryptoService],
})
export class FieldCryptoModule {}
