import { Module } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseShutdownHook } from '@/datasources/db/v2/database-shutdown.hook';
import { DatabaseInitializeHook } from '@/datasources/db/v2/database-initialize.hook';
import { DatabaseMigrationHook } from '@/datasources/db/v2/database-migration.hook';

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
