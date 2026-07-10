// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletEncryptionModule } from '@/modules/wallets/domain/wallet-encryption.module';
import { WalletsRepository } from '@/modules/wallets/domain/wallets.repository';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Wallet]),
    WalletEncryptionModule,
  ],
  providers: [
    {
      provide: IWalletsRepository,
      useClass: WalletsRepository,
    },
  ],
  exports: [IWalletsRepository],
})
export class WalletsModule {}
