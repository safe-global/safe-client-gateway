// SPDX-License-Identifier: FSL-1.1-MIT

import type { DataSource } from 'typeorm';
import type { QueryResultCache } from 'typeorm/cache/QueryResultCache';
import type { MockedObject } from 'vitest';

export const mockQueryResultCache = {
  remove: vi.fn(),
} as MockedObject<QueryResultCache>;

export const mockPostgresDataSource = {
  query: vi.fn(),
  runMigrations: vi.fn(),
  initialize: vi.fn(),
  queryResultCache: mockQueryResultCache,
} as unknown as MockedObject<DataSource>;
