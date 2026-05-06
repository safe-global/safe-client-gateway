// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';

const targetedMessagingDatasource = {
  getUnprocessedOutreaches: jest.fn(),
  getOutreachOrFail: jest.fn(),
  createOutreach: jest.fn(),
  createTargetedSafes: jest.fn(),
  getTargetedSafe: jest.fn(),
  createSubmission: jest.fn(),
  getSubmission: jest.fn(),
} as jest.MockedObjectDeep<ITargetedMessagingDatasource>;

@Module({
  imports: [PostgresDatabaseModule],
  providers: [
    {
      provide: ITargetedMessagingDatasource,
      useFactory: (): jest.MockedObjectDeep<ITargetedMessagingDatasource> => {
        return jest.mocked(targetedMessagingDatasource);
      },
    },
  ],
  exports: [ITargetedMessagingDatasource],
})
export class TestTargetedMessagingDatasourceModule {}
