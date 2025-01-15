import { DataSource } from 'typeorm';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';

export default new DataSource({
  entities: ['dist/src/**/entities/*.entity.db.js'],
  ...postgresConfig({
    ...configuration().db.connection.postgres,
    type: 'postgres',
  }),
});
