import { Module } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { mockPostgresDatabaseService } from '@/datasources/db/v2/__tests__/postgresql-database.service.mock';

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
