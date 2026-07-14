// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ChainApiManager } from '@/datasources/common/chain-api.manager';

class TestApiManager extends ChainApiManager<{ chainId: string }> {
  createApi = vi.fn((chainId: string) => Promise.resolve({ chainId }));

  getApi(chainId: string): Promise<{ chainId: string }> {
    return this.getOrCreateApi(chainId);
  }
}

describe('ChainApiManager', () => {
  let target: TestApiManager;

  beforeEach(() => {
    target = new TestApiManager();
  });

  it('should create an API instance on first retrieval and cache it', async () => {
    const chainId = faker.string.numeric();

    const first = await target.getApi(chainId);
    const second = await target.getApi(chainId);

    expect(second).toBe(first);
    expect(target.createApi).toHaveBeenCalledTimes(1);
  });

  it('should cache API instances per chain', async () => {
    const firstChainId = '1';
    const secondChainId = '2';

    const first = await target.getApi(firstChainId);
    const second = await target.getApi(secondChainId);

    expect(first).not.toBe(second);
    expect(target.createApi).toHaveBeenCalledTimes(2);
  });

  it('should create a new API instance after destruction', async () => {
    const chainId = faker.string.numeric();

    const first = await target.getApi(chainId);
    target.destroyApi(chainId);
    const second = await target.getApi(chainId);

    expect(second).not.toBe(first);
    expect(target.createApi).toHaveBeenCalledTimes(2);
  });

  it('should not throw when destroying a non-cached API instance', () => {
    expect(() => target.destroyApi(faker.string.numeric())).not.toThrow();
  });
});
