// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { KmsEncryptionModule } from '@/datasources/kms/kms-encryption.module';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';
import { WalletsRepository } from '@/modules/wallets/domain/wallets.repository';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Wallet]),
    KmsEncryptionModule,
  ],
  providers: [
    WalletEncryptionService,
    {
      provide: IWalletsRepository,
      useClass: WalletsRepository,
    },
  ],
  exports: [IWalletsRepository, WalletEncryptionService],
})
export class WalletsModule {}
