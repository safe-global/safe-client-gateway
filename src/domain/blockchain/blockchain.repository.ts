import { IBlockchainRepository } from '@/domain/blockchain/blockchain.repository.interface';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class BlockchainRepository implements IBlockchainRepository {
  constructor(
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
  ) {}

  clearClient(chainId: string): void {
    this.blockchainApiManager.destroyBlockchainApi(chainId);
  }
}
