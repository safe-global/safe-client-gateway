import { Module } from '@nestjs/common';
import { createPublicClient } from 'viem';
import { BlockchainDataSource } from '@/datasources/blockchain/blockchain.datasource';
import { IBlockchainDataSource } from '@/domain/interfaces/blockchain.datasource.interface';

@Module({
  providers: [
    {
      provide: 'createPublicClient',
      useFactory: createPublicClient,
    },
    { provide: IBlockchainDataSource, useClass: BlockchainDataSource },
  ],
  exports: [IBlockchainDataSource],
})
export class BlockchainDataSourceModule {}
