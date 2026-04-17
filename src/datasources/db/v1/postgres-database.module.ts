import fs from 'node:fs';
import { Module } from '@nestjs/common';
import postgres from 'postgres';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { ICachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver.interface';
import { PostgresDatabaseMigrationHook } from '@/datasources/db/v1/postgres-database.migration.hook';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { PostgresDatabaseShutdownHook } from '@/datasources/db/v1/postgres-database.shutdown.hook';

function dbFactory(configurationService: IConfigurationService): postgres.Sql {
  const caPath = configurationService.get<string>(
    'db.connection.postgres.ssl.caPath',
  );
  const ca: string | undefined =
    caPath && caPath.length > 0 ? fs.readFileSync(caPath, 'utf8') : undefined;

  const sslConfig = configurationService.getOrThrow(
    'db.connection.postgres.ssl.enabled',
  )
    ? {
        requestCert: configurationService.getOrThrow(
          'db.connection.postgres.ssl.requestCert',
        ),
        rejectUnauthorized: configurationService.getOrThrow(
          'db.connection.postgres.ssl.rejectUnauthorized',
        ),
        ca,
      }
    : false;
  return postgres({
    host: configurationService.getOrThrow('db.connection.postgres.host'),
    port: configurationService.getOrThrow('db.connection.postgres.port'),
    db: configurationService.getOrThrow('db.connection.postgres.database'),
    user: configurationService.getOrThrow('db.connection.postgres.username'),
    password: configurationService.getOrThrow(
      'db.connection.postgres.password',
    ),
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
    {
      provide: ICachedQueryResolver,
      useClass: CachedQueryResolver,
    },
    PostgresDatabaseShutdownHook,
    PostgresDatabaseMigrationHook,
  ],
  exports: ['DB_INSTANCE', ICachedQueryResolver],
})
export class PostgresDatabaseModule {}
