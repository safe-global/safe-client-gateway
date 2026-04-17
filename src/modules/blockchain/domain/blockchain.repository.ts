// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import type { IBlockchainRepository } from '@/modules/blockchain/domain/blockchain.repository.interface';

@Injectable()
export class BlockchainRepository implements IBlockchainRepository {
  constructor(
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
  ) {}

  clearApi(chainId: string): void {
    this.blockchainApiManager.destroyApi(chainId);
  }
}
