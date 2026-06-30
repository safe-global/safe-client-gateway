// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';

const blockaidApi = {
  scanTransaction: vi.fn(),
  reportTransaction: vi.fn(),
};

@Module({
  providers: [
    {
      provide: IBlockaidApi,
      useFactory: (): MockedObject<IBlockaidApi> => {
        return vi.mocked(blockaidApi);
      },
    },
  ],
  exports: [IBlockaidApi],
})
export class TestBlockaidApiModule {}
