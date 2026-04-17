import { Module } from '@nestjs/common';
import { mockPostgresDatabaseService } from '@/datasources/db/v2/__tests__/postgresql-database.service.mock';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

@Module({
  providers: [
    {
      provide: PostgresDatabaseService,
      useFactory: (): jest.MockedObjectDeep<PostgresDatabaseService> => {
        return jest.mocked(mockPostgresDatabaseService);
      },
    },
  ],
  exports: [PostgresDatabaseService],
})
export class TestPostgresDatabaseModuleV2 {}
