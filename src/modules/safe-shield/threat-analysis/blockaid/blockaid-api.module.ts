import { Module } from '@nestjs/common';
import { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import { BlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.service';

@Module({
  providers: [{ provide: IBlockaidApi, useClass: BlockaidApi }],
  exports: [IBlockaidApi],
})
export class BlockaidApiModule {}
