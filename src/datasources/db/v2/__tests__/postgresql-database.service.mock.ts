import type { EntityManager } from 'typeorm';
import { mockEntityManager } from '@/datasources/db/v2/__tests__/entity-manager.mock';
import { mockPostgresDataSource } from '@/datasources/db/v2/__tests__/postgresql-datasource.mock';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

export const mockPostgresDatabaseService = {
  getDataSource: jest.fn().mockImplementation(() => mockPostgresDataSource),
  isInitialized: jest.fn(),
  initializeDatabaseConnection: jest
    .fn()
    .mockImplementation(() => mockPostgresDataSource),
  destroyDatabaseConnection: jest.fn(),
  getRepository: jest.fn(),
  transaction: jest
    .fn()
    .mockImplementation(
      (callback: (mockEntityManager: EntityManager) => EntityManager) => {
        return callback(mockEntityManager);
      },
    ),
} as jest.MockedObjectDeep<PostgresDatabaseService>;
