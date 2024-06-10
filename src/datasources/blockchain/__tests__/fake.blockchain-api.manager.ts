import { IBlockchainApi } from '@/domain/interfaces/blockchain-api.interface';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { Injectable } from '@nestjs/common';
import { createPublicClient, http } from 'viem';
import { localhost } from 'viem/chains';

@Injectable()
export class FakeBlockchainApiManager implements IBlockchainApiManager {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBlockchainApi(chainId: string): Promise<IBlockchainApi> {
    const client = createPublicClient({
      chain: localhost,
      transport: http(),
    }).extend(() => ({
      call: this.eth_call,
    }));

    return Promise.resolve({
      getClient: () => client,
      destroyClient: this.destroyBlockchainApi.bind(this),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  destroyBlockchainApi(chainId: string): void {}

  // Used for mocking `eth_call` in tests
  eth_call = jest.fn();
}
