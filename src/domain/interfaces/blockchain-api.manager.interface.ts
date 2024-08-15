import { BlockchainApiManager } from '@/datasources/blockchain/blockchain-api.manager';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { PublicClient } from 'viem';
import { Module } from '@nestjs/common';
import { IApiManager } from '@/domain/interfaces/api.manager.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

export const IBlockchainApiManager = Symbol('IBlockchainApiManager');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IBlockchainApiManager extends IApiManager<PublicClient> {}

@Module({
  imports: [ConfigApiModule],
  providers: [
    HttpErrorFactory,
    { provide: IBlockchainApiManager, useClass: BlockchainApiManager },
  ],
  exports: [IBlockchainApiManager],
})
export class BlockchainApiManagerModule {}
