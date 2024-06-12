import { BlockchainApiManager } from '@/datasources/blockchain/blockchain-api.manager';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { PublicClient } from 'viem';
import { Module } from '@nestjs/common';
import { IApiManager } from '@/domain/interfaces/api.manager.interface';

export const IBlockchainApiManager = Symbol('IBlockchainApiManager');

export interface IBlockchainApiManager extends IApiManager<PublicClient> {}

@Module({
  imports: [ConfigApiModule],
  providers: [
    { provide: IBlockchainApiManager, useClass: BlockchainApiManager },
  ],
  exports: [IBlockchainApiManager],
})
export class BlockchainApiManagerModule {}
