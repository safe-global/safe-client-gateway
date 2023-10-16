import * as postgres from 'postgres';
import { Module } from '@nestjs/common';
import { PostgresDatabaseHook } from '@/datasources/db/postgres-database.hook';
import { IConfigurationService } from '@/config/configuration.service.interface';

function dbFactory(configurationService: IConfigurationService): postgres.Sql {
  return postgres({
    host: configurationService.getOrThrow('db.postgres.host'),
    port: configurationService.getOrThrow('db.postgres.port'),
    db: configurationService.getOrThrow('db.postgres.database'),
    user: configurationService.getOrThrow('db.postgres.username'),
    password: configurationService.getOrThrow('db.postgres.password'),
  });
}

@Module({
  providers: [
    {
      provide: 'DB_INSTANCE',
      useFactory: dbFactory,
      inject: [IConfigurationService],
    },
    PostgresDatabaseHook,
  ],
  exports: ['DB_INSTANCE'],
})
export class PostgresDatabaseModule {}
