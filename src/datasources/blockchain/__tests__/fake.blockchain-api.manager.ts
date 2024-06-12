import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { Injectable } from '@nestjs/common';
@Injectable()
export class FakeBlockchainApiManager implements IBlockchainApiManager {
  getBlockchainApi = jest.fn();

  destroyBlockchainApi = jest.fn();
}
