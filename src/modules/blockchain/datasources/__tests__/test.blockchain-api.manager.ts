import { Module } from '@nestjs/common';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { FakeBlockchainApiManager } from '@/modules/blockchain/datasources/__tests__/fake.blockchain-api.manager';
import { FakeBlockchainRepository } from '@/modules/blockchain/domain/__tests__/fake.blockchain.repository';
import { IBlockchainRepository } from '@/modules/blockchain/domain/blockchain.repository.interface';

@Module({
  providers: [
    {
      provide: IBlockchainApiManager,
      useClass: FakeBlockchainApiManager,
    },
    {
      provide: IBlockchainRepository,
      useClass: FakeBlockchainRepository,
    },
  ],
  exports: [IBlockchainApiManager, IBlockchainRepository],
})
export class TestBlockchainApiManagerModule {}
