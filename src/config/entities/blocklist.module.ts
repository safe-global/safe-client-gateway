import { IBlocklistService } from '@/config/entities/blocklist.interface';
import { BlocklistService } from '@/config/entities/blocklist.service';
import { Global, Module } from '@nestjs/common';

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
