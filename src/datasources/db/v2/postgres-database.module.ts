import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseInitializeHook } from '@/datasources/db/v2/database-initialize.hook';
import { DatabaseMigrationHook } from '@/datasources/db/v2/database-migration.hook';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { DatabaseShutdownHook } from '@/datasources/db/v2/database-shutdown.hook';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

@Module({
  imports: [ConfigModule],
  providers: [
    PostgresDatabaseService,
    DatabaseMigrator,
    DatabaseInitializeHook,
    DatabaseShutdownHook,
    DatabaseMigrationHook,
  ],
  exports: [PostgresDatabaseService, DatabaseMigrator],
})
export class PostgresDatabaseModuleV2 {}
