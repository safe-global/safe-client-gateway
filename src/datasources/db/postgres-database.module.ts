import postgres from 'postgres';
import { Module } from '@nestjs/common';
import { PostgresDatabaseShutdownHook } from '@/datasources/db/postgres-database.shutdown.hook';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseMigrationHook } from '@/datasources/db/postgres-database.migration.hook';
import fs from 'fs';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';

function dbFactory(configurationService: IConfigurationService): postgres.Sql {
  const caPath = configurationService.get<string>('db.postgres.ssl.caPath');
  const ca: string | undefined =
    caPath && caPath.length > 0 ? fs.readFileSync(caPath, 'utf8') : undefined;

  const sslConfig = configurationService.getOrThrow('db.postgres.ssl.enabled')
    ? {
        requestCert: configurationService.getOrThrow(
          'db.postgres.ssl.requestCert',
        ),
        rejectUnauthorized: configurationService.getOrThrow(
          'db.postgres.ssl.rejectUnauthorized',
        ),
        ca,
      }
    : false;
  return postgres({
    host: configurationService.getOrThrow('db.postgres.host'),
    port: configurationService.getOrThrow('db.postgres.port'),
    db: configurationService.getOrThrow('db.postgres.database'),
    user: configurationService.getOrThrow('db.postgres.username'),
    password: configurationService.getOrThrow('db.postgres.password'),
    ssl: sslConfig,
  });
}

function migratorFactory(sql: postgres.Sql): PostgresDatabaseMigrator {
  return new PostgresDatabaseMigrator(sql);
}

@Module({
  providers: [
    {
      provide: 'DB_INSTANCE',
      useFactory: dbFactory,
      inject: [IConfigurationService],
    },
    {
      provide: PostgresDatabaseMigrator,
      useFactory: migratorFactory,
      inject: ['DB_INSTANCE'],
    },
    PostgresDatabaseShutdownHook,
    PostgresDatabaseMigrationHook,
  ],
  exports: ['DB_INSTANCE'],
})
export class PostgresDatabaseModule {}
