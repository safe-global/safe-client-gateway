// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';

const targetedMessagingDatasource = {
  getUnprocessedOutreaches: vi.fn(),
  getOutreachOrFail: vi.fn(),
  createOutreach: vi.fn(),
  createTargetedSafes: vi.fn(),
  getTargetedSafe: vi.fn(),
  createSubmission: vi.fn(),
  getSubmission: vi.fn(),
} as MockedObject<ITargetedMessagingDatasource>;

@Module({
  imports: [PostgresDatabaseModule],
  providers: [
    {
      provide: ITargetedMessagingDatasource,
      useFactory: (): MockedObject<ITargetedMessagingDatasource> => {
        return vi.mocked(targetedMessagingDatasource);
      },
    },
  ],
  exports: [ITargetedMessagingDatasource],
})
export class TestTargetedMessagingDatasourceModule {}
