import * as postgres from 'postgres';
import { Module } from '@nestjs/common';
import { PostgresDatabaseShutdownHook } from '@/datasources/db/postgres-database.shutdown.hook';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseMigrationHook } from '@/datasources/db/postgres-database.migration.hook';
import * as fs from 'fs';

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

@Module({
  providers: [
    {
      provide: 'DB_INSTANCE',
      useFactory: dbFactory,
      inject: [IConfigurationService],
    },
    PostgresDatabaseShutdownHook,
    PostgresDatabaseMigrationHook,
  ],
  exports: ['DB_INSTANCE'],
})
export class PostgresDatabaseModule {}
