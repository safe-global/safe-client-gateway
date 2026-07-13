// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { KmsEncryptionModule } from '@/datasources/kms/kms-encryption.module';
import { SpaceFieldEncryptionService } from '@/modules/spaces/domain/space-field-encryption.service';

@Module({
  imports: [KmsEncryptionModule],
  providers: [SpaceFieldEncryptionService],
  exports: [SpaceFieldEncryptionService],
})
export class SpaceFieldEncryptionModule {}
