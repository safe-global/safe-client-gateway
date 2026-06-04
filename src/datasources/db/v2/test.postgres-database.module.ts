// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { mockPostgresDatabaseService } from '@/datasources/db/v2/__tests__/postgresql-database.service.mock';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

@Module({
  providers: [
    {
      provide: PostgresDatabaseService,
      useFactory: (): MockedObject<PostgresDatabaseService> => {
        return vi.mocked(mockPostgresDatabaseService);
      },
    },
  ],
  exports: [PostgresDatabaseService],
})
export class TestPostgresDatabaseModuleV2 {}
