import { FakeBlockchainApiManager } from '@/modules/blockchain/datasources/__tests__/fake.blockchain-api.manager';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: IBlockchainApiManager,
      useClass: FakeBlockchainApiManager,
    },
  ],
  exports: [IBlockchainApiManager],
})
export class TestBlockchainApiManagerModule {}
