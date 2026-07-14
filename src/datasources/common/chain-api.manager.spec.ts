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

  it('should share one creation between concurrent retrievals', async () => {
    const chainId = faker.string.numeric();
    let resolveCreation!: (api: { chainId: string }) => void;
    target.createApi.mockReturnValue(
      new Promise((resolve) => {
        resolveCreation = resolve;
      }),
    );

    const [first, second] = [target.getApi(chainId), target.getApi(chainId)];
    resolveCreation({ chainId });

    expect(await first).toBe(await second);
    expect(target.createApi).toHaveBeenCalledTimes(1);
  });

  it('should not cache failed creations', async () => {
    const chainId = faker.string.numeric();
    const error = new Error('Creation failed');
    target.createApi.mockRejectedValueOnce(error);

    await expect(target.getApi(chainId)).rejects.toThrow(error);
    const api = await target.getApi(chainId);

    expect(api).toStrictEqual({ chainId });
    expect(target.createApi).toHaveBeenCalledTimes(2);
  });

  it('should not evict a replacement entry when a destroyed creation fails', async () => {
    const chainId = faker.string.numeric();
    const error = new Error('Creation failed');
    let rejectCreation!: (error: Error) => void;
    target.createApi.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectCreation = reject;
      }),
    );

    const first = target.getApi(chainId);
    target.destroyApi(chainId);
    const second = await target.getApi(chainId);
    rejectCreation(error);

    await expect(first).rejects.toThrow(error);
    expect(await target.getApi(chainId)).toBe(second);
    expect(target.createApi).toHaveBeenCalledTimes(2);
  });

  it('should reject instead of throwing when creation throws synchronously', async () => {
    const chainId = faker.string.numeric();
    const error = new Error('Creation failed');
    target.createApi.mockImplementationOnce(() => {
      throw error;
    });

    await expect(target.getApi(chainId)).rejects.toThrow(error);
  });
});
