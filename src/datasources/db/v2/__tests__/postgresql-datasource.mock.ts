import type { DataSource } from 'typeorm';
import { type QueryResultCache } from 'typeorm/cache/QueryResultCache';

export const mockQueryResultCache = {
  remove: jest.fn(),
} as jest.MockedObjectDeep<QueryResultCache>;

export const mockPostgresDataSource = {
  query: jest.fn(),
  runMigrations: jest.fn(),
  initialize: jest.fn(),
  queryResultCache: mockQueryResultCache,
} as jest.MockedObjectDeep<DataSource>;
