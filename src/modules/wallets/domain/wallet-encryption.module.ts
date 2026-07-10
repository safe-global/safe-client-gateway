// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { FieldCryptoModule } from '@/datasources/kms/field-crypto.module';
import { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';

@Module({
  imports: [FieldCryptoModule],
  providers: [WalletEncryptionService],
  exports: [WalletEncryptionService],
})
export class WalletEncryptionModule {}
