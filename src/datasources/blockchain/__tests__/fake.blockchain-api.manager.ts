import { IBlockchainApi } from '@/domain/interfaces/blockchain-api.interface';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { Injectable } from '@nestjs/common';
import { createPublicClient, custom } from 'viem';

@Injectable()
export class FakeBlockchainApiManager implements IBlockchainApiManager {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBlockchainApi(chainId: string): Promise<IBlockchainApi> {
    const client = createPublicClient({
      transport: custom({
        request: this.request,
      }),
    });

    return Promise.resolve({
      getClient: () => client,
      destroyClient: this.destroyBlockchainApi.bind(this),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  destroyBlockchainApi(chainId: string): void {}

  // Used for mocking requests in tests
  request = jest.fn();
}
