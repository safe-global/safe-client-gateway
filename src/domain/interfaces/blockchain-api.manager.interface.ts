import { BlockchainApiManager } from '@/datasources/blockchain/blockchain-api.manager';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { PublicClient } from 'viem';
import { Module } from '@nestjs/common';

export const IBlockchainApiManager = Symbol('IBlockchainApiManager');

export interface IBlockchainApiManager {
  getBlockchainApi(chainId: string): Promise<PublicClient>;

  destroyBlockchainApi(chainId: string): void;
}

@Module({
  imports: [ConfigApiModule],
  providers: [
    { provide: IBlockchainApiManager, useClass: BlockchainApiManager },
  ],
  exports: [IBlockchainApiManager],
})
export class BlockchainApiManagerModule {}
