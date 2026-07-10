// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { FieldCryptoModule } from '@/datasources/kms/field-crypto.module';
import { SpaceFieldEncryptionService } from '@/modules/spaces/domain/space-field-encryption.service';

@Module({
  imports: [FieldCryptoModule],
  providers: [SpaceFieldEncryptionService],
  exports: [SpaceFieldEncryptionService],
})
export class SpaceFieldEncryptionModule {}
