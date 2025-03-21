import { DataSource } from 'typeorm';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';

const dbConfig = configuration().db;
export default new DataSource({
  migrationsTableName: dbConfig.orm.migrationsTableName,
  entities: ['dist/src/**/entities/*.entity.db.js'],
  ...postgresConfig({
    ...dbConfig.connection.postgres,
    type: 'postgres',
  }),
});
