// SPDX-License-Identifier: FSL-1.1-MIT

import { jest } from 'bun:test';
import type { DataSource } from 'typeorm';
import type { QueryResultCache } from 'typeorm/cache/QueryResultCache.js';
import type { MockedObject } from '#/__tests__/mocks';

export const mockQueryResultCache = {
  remove: jest.fn(),
} as MockedObject<QueryResultCache>;

export const mockPostgresDataSource = {
  query: jest.fn(),
  runMigrations: jest.fn(),
  initialize: jest.fn(),
  queryResultCache: mockQueryResultCache,
} as unknown as MockedObject<DataSource>;
