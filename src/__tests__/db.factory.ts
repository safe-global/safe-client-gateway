import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import configuration from '@/config/entities/__tests__/configuration';

export function dbFactory(): postgres.Sql {
  const config = configuration();
  const isCIContext = process.env.CI?.toLowerCase() === 'true';

  return postgres({
    host: config.db.postgres.host,
    port: parseInt(config.db.postgres.port),
    db: config.db.postgres.database,
    user: config.db.postgres.username,
    password: config.db.postgres.password,
    // If running on a CI context (e.g.: GitHub Actions),
    // disable certificate pinning for the test execution
    ssl:
      isCIContext || !config.db.postgres.ssl.enabled
        ? false
        : {
            requestCert: config.db.postgres.ssl.requestCert,
            rejectUnauthorized: config.db.postgres.ssl.rejectUnauthorized,
            ca: fs.readFileSync(
              path.join(process.cwd(), 'db_config/test/server.crt'),
              'utf8',
            ),
          },
  });
}
