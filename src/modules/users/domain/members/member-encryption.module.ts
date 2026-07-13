// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { KmsEncryptionModule } from '@/datasources/kms/kms-encryption.module';
import { MemberEncryptionService } from '@/modules/users/domain/members/member-encryption.service';

@Module({
  imports: [KmsEncryptionModule],
  providers: [MemberEncryptionService],
  exports: [MemberEncryptionService],
})
export class MemberEncryptionModule {}
