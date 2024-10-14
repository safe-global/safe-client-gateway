import { Module } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

const postgresDatabaseServiceMock = {
  getDataSource: jest.fn(),
  isInitialized: jest.fn(),
  initializeDatabaseConnection: jest.fn(),
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
