// SPDX-License-Identifier: FSL-1.1-MIT
import { Global, Module } from '@nestjs/common';
import { IBlocklistService } from '@/config/entities/blocklist.interface';
import { BlocklistService } from '@/config/entities/blocklist.service';

@Global()
@Module({
  providers: [
    {
      provide: IBlocklistService,
      useClass: BlocklistService,
    },
  ],
  exports: [IBlocklistService],
})
export class BlocklistModule {}
