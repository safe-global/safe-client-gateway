import { Injectable } from '@nestjs/common';
import type { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';

@Injectable()
export class FakeBlockchainApiManager implements IBlockchainApiManager {
  getApi = jest.fn();

  destroyApi = jest.fn();
}
