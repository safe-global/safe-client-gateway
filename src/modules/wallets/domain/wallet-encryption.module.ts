// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { KmsEncryptionModule } from '@/datasources/kms/kms-encryption.module';
import { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';

@Module({
  imports: [KmsEncryptionModule],
  providers: [WalletEncryptionService],
  exports: [WalletEncryptionService],
})
export class WalletEncryptionModule {}
