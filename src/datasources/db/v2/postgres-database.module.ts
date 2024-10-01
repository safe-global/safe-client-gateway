import { Module } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [PostgresDatabaseService, DatabaseMigrator],
  exports: [PostgresDatabaseService, DatabaseMigrator],
})
export class PostgresDatabaseModule {}
