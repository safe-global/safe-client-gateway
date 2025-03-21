import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { WalletsRepository } from '@/domain/wallets/wallets.repository';
import { IWalletsRepository } from '@/domain/wallets/wallets.repository.interface';

@Module({
  imports: [PostgresDatabaseModuleV2, TypeOrmModule.forFeature([Wallet])],
  providers: [
    {
      provide: IWalletsRepository,
      useClass: WalletsRepository,
    },
  ],
  exports: [IWalletsRepository],
})
export class WalletsRepositoryModule {}
