import type { DataSource } from 'typeorm';

export const mockPostgresDataSource = {
  query: jest.fn(),
  runMigrations: jest.fn(),
  initialize: jest.fn(),
} as jest.MockedObjectDeep<DataSource>;
