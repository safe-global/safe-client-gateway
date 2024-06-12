import { BlockchainRepository } from '@/domain/blockchain/blockchain.repository';
import { BlockchainApiManagerModule } from '@/domain/interfaces/blockchain-api.manager.interface';
import { Module } from '@nestjs/common';

export const IBlockchainRepository = Symbol('IBlockchainRepository');

export interface IBlockchainRepository {
  clearApi(chainId: string): void;
}

@Module({
  imports: [BlockchainApiManagerModule],
  providers: [
    { provide: IBlockchainRepository, useClass: BlockchainRepository },
  ],
  exports: [IBlockchainRepository],
})
export class BlockchainRepositoryModule {}
