// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import { mockPostgresDatabaseService } from '#/datasources/db/v2/__tests__/postgresql-database.service.mock';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';

@Module({
  providers: [
    {
      provide: PostgresDatabaseService,
      useFactory: (): MockedObject<PostgresDatabaseService> => {
        return mocked(mockPostgresDatabaseService);
      },
    },
  ],
  exports: [PostgresDatabaseService],
})
export class TestPostgresDatabaseModuleV2 {}
