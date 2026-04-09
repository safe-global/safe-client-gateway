// SPDX-License-Identifier: FSL-1.1-MIT
import { DataSource } from 'typeorm';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';

const dbConfig = configuration().db;
export default new DataSource({
  migrationsTableName: dbConfig.orm.migrationsTableName,
  entities: ['src/**/entities/*.entity.db.ts'],
  ...postgresConfig({
    ...dbConfig.connection.postgres,
    type: 'postgres',
  }),
});
