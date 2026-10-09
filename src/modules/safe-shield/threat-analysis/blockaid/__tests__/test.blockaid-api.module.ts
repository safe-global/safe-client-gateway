// SPDX-License-Identifier: FSL-1.1-MIT

import { jest } from 'bun:test';
import { Module } from '@nestjs/common';
import type { MockedObject } from '#/__tests__/mocks';
import { IBlockaidApi } from '#/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';

const blockaidApi = {
  scanTransaction: jest.fn(),
  reportTransaction: jest.fn(),
  scanAddressBulk: jest.fn(),
};

@Module({
  providers: [
    {
      provide: IBlockaidApi,
      useFactory: (): MockedObject<IBlockaidApi> => {
        return blockaidApi as MockedObject<IBlockaidApi>;
      },
    },
  ],
  exports: [IBlockaidApi],
})
export class TestBlockaidApiModule {}
