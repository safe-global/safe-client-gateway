import { readFileSync } from 'fs';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

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
  const isCIContext = process.env.CI?.toLowerCase() === 'true';
  const isSslEnabled = !isCIContext && postgresEnvConfig.ssl.enabled;
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
    // logging: !isCIContext,
    ssl: isSslEnabled
      ? {
          ca: postgresCa,
          requestCert: postgresEnvConfig.ssl.requestCert,
          rejectUnauthorized: postgresEnvConfig.ssl.rejectUnauthorized,
        }
      : false,
  };
};
