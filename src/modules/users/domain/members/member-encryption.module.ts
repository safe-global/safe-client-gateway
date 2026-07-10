// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { FieldCryptoModule } from '@/datasources/kms/field-crypto.module';
import { MemberEncryptionService } from '@/modules/users/domain/members/member-encryption.service';

@Module({
  imports: [FieldCryptoModule],
  providers: [MemberEncryptionService],
  exports: [MemberEncryptionService],
})
export class MemberEncryptionModule {}
