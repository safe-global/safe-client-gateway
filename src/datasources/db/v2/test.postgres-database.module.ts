import { Module } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { DataSource } from 'typeorm';

export const postgresDataSourceMock = {
  query: jest.fn(),
  runMigrations: jest.fn(),
  initialize: jest.fn(),
} as jest.MockedObjectDeep<DataSource>;

export const postgresDatabaseServiceMock = {
  getDataSource: jest.fn().mockImplementation(() => postgresDataSourceMock),
  isInitialized: jest.fn(),
  initializeDatabaseConnection: jest
    .fn()
    .mockImplementation(() => postgresDataSourceMock),
  destroyDatabaseConnection: jest.fn(),
  getRepository: jest.fn(),
  transaction: jest.fn(),
  getTransactionRunner: jest.fn(),
} as jest.MockedObjectDeep<PostgresDatabaseService>;

@Module({
  providers: [
    {
      provide: PostgresDatabaseService,
      useFactory: (): jest.MockedObjectDeep<PostgresDatabaseService> => {
        return jest.mocked(postgresDatabaseServiceMock);
      },
    },
  ],
  exports: [PostgresDatabaseService],
})
export class TestPostgresDatabaseModuleV2 {}
