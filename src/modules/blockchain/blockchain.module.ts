import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { BlockchainApiManager } from '@/modules/blockchain/datasources/blockchain-api.manager';
import { IBlockchainRepository } from '@/modules/blockchain/domain/blockchain.repository.interface';
import { BlockchainRepository } from '@/modules/blockchain/domain/blockchain.repository';

@Module({
  imports: [ConfigApiModule],
  providers: [
    HttpErrorFactory,
    { provide: IBlockchainApiManager, useClass: BlockchainApiManager },
    { provide: IBlockchainRepository, useClass: BlockchainRepository },
  ],
  exports: [IBlockchainApiManager, IBlockchainRepository],
})
export class BlockchainModule {}
