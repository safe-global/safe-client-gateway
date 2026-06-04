// SPDX-License-Identifier: FSL-1.1-MIT

import type { EntityManager } from 'typeorm';
import type { MockedObject } from 'vitest';
import { mockEntityManager } from '@/datasources/db/v2/__tests__/entity-manager.mock';
import { mockPostgresDataSource } from '@/datasources/db/v2/__tests__/postgresql-datasource.mock';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

export const mockPostgresDatabaseService = {
  getDataSource: vi.fn().mockImplementation(() => mockPostgresDataSource),
  isInitialized: vi.fn(),
  initializeDatabaseConnection: vi
    .fn()
    .mockImplementation(() => mockPostgresDataSource),
  destroyDatabaseConnection: vi.fn(),
  getRepository: vi.fn(),
  transaction: vi
    .fn()
    .mockImplementation(
      (callback: (mockEntityManager: EntityManager) => EntityManager) => {
        return callback(mockEntityManager);
      },
    ),
} as MockedObject<PostgresDatabaseService>;
