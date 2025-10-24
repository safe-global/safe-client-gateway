import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetRepository } from '@/datasources/db/asset.repository';
import { AssetRegistryService } from '@/domain/common/services/asset-registry.service';
import { AssetSeederService } from '@/domain/common/services/asset-seeder.service';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { Asset } from '@/datasources/db/entities/asset.entity.db';

@Module({
  imports: [PostgresDatabaseModuleV2, TypeOrmModule.forFeature([Asset])],
  providers: [AssetRepository, AssetRegistryService, AssetSeederService],
  exports: [AssetRegistryService],
})
export class AssetRegistryModule {}
