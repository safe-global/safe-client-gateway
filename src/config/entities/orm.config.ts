import { readFileSync } from 'fs';
import { DataSource } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import { default as Configuration } from './configuration';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

//@TODO: move this to an interface file
//@TODO: change the way config is read from the configuration file
interface IPostgresEnvConfig {
  type: 'postgres';
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  ssl: {
    enabled: boolean;
    caPath: string | undefined;
    requestCert: boolean;
    rejectUnauthorized: boolean;
  };
}

export const postgresConfig = (
  postgresEnvConfig: IPostgresEnvConfig,
): PostgresConnectionOptions => {
  const isSslEnabled = postgresEnvConfig.ssl.enabled;
  const postgresCa =
    isSslEnabled &&
    postgresEnvConfig.ssl.caPath &&
    postgresEnvConfig.ssl.caPath.length > 0
      ? readFileSync(postgresEnvConfig.ssl.caPath, 'utf8')
      : undefined;

  return {
    type: 'postgres',
    synchronize: false,
    host: postgresEnvConfig.host,
    port: ~~postgresEnvConfig.port,
    username: postgresEnvConfig.username,
    password: postgresEnvConfig.password,
    database: postgresEnvConfig.database,
    migrations: ['dist/migrations/*.js'],
    entities: ['dist/src/routes/**/*.entity{ .ts,.js}'],
    ssl: !isSslEnabled
      ? false
      : {
          ca: postgresCa,
          requestCert: postgresEnvConfig.ssl.requestCert,
          rejectUnauthorized: postgresEnvConfig.ssl.rejectUnauthorized,
        },
  };
};

export const postgresFactory = (
  configService: ConfigService,
): PostgresConnectionOptions =>
  postgresConfig(configService.getOrThrow('db.postgres'));

export default new DataSource(
  postgresConfig({ ...Configuration().db.postgres, type: 'postgres' }),
);
