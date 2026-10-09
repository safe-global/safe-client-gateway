// SPDX-License-Identifier: FSL-1.1-MIT

import { jest } from 'bun:test';
import { Module } from '@nestjs/common';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import { PostgresDatabaseModule } from '#/datasources/db/v1/postgres-database.module';
import { ITargetedMessagingDatasource } from '#/domain/interfaces/targeted-messaging.datasource.interface';

const targetedMessagingDatasource = {
  getUnprocessedOutreaches: jest.fn(),
  getOutreachOrFail: jest.fn(),
  createOutreach: jest.fn(),
  createTargetedSafes: jest.fn(),
  getTargetedSafe: jest.fn(),
  createSubmission: jest.fn(),
  getSubmission: jest.fn(),
} as MockedObject<ITargetedMessagingDatasource>;

@Module({
  imports: [PostgresDatabaseModule],
  providers: [
    {
      provide: ITargetedMessagingDatasource,
      useFactory: (): MockedObject<ITargetedMessagingDatasource> => {
        return mocked(targetedMessagingDatasource);
      },
    },
  ],
  exports: [ITargetedMessagingDatasource],
})
export class TestTargetedMessagingDatasourceModule {}
