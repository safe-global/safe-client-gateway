// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { hexToNumber, TransactionReceiptNotFoundError, toHex } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import type { IConfigApi } from '#/domain/interfaces/config-api.interface';
import { BlockchainApiManager } from '#/modules/blockchain/datasources/blockchain-api.manager';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import { rpcUriBuilder } from '#/modules/chains/domain/entities/__tests__/rpc-uri.builder';
import { RpcUriAuthentication } from '#/modules/chains/domain/entities/rpc-uri-authentication.entity';
import { rawify } from '#/validation/entities/raw.entity';

const configApiMock = vi.mocked({
  getChain: vi.fn(),
} as MockedObject<IConfigApi>);

describe('BlockchainApiManager', () => {
  let target: BlockchainApiManager;
  let fakeCacheService: FakeCacheService;
  const infuraApiKey = faker.string.hexadecimal({ length: 32 });
  const expirationTimeInSeconds = faker.number.int();

  beforeEach(() => {
    vi.resetAllMocks();

    fakeCacheService = new FakeCacheService();
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('blockchain.infura.apiKey', infuraApiKey);
    fakeConfigurationService.set(
      'expirationTimeInSeconds.rpc',
      expirationTimeInSeconds,
    );
    target = new BlockchainApiManager(
      fakeConfigurationService,
      configApiMock,
      fakeCacheService,
    );
  });

  describe('getApi', () => {
    it('caches the API', async () => {
      const chain = chainBuilder().build();
      configApiMock.getChain.mockResolvedValue(rawify(chain));

      const api = await target.getApi(chain.chainId);
      const cachedApi = await target.getApi(chain.chainId);

      expect(api).toBe(cachedApi);
    });

    it('should include the INFURA_API_KEY in the RPC URI for an Infura URI with API_KEY_PATH authentication', async () => {
      const rpcUriValue = `https://${faker.string.sample()}.infura.io/v3/`;
      const chain = chainBuilder()
        .with(
          'rpcUri',
          rpcUriBuilder()
            .with('value', rpcUriValue)
            .with('authentication', RpcUriAuthentication.ApiKeyPath)
            .build(),
        )
        .build();
      configApiMock.getChain.mockResolvedValue(rawify(chain));

      const api = await target.getApi(chain.chainId);

      expect(api.chain?.rpcUrls.default.http[0]).toContain(infuraApiKey);
    });

    it('should not include the INFURA_API_KEY in the RPC URI for an Infura URI without API_KEY_PATH authentication', async () => {
      const rpcUriValue = `https://${faker.string.sample()}.infura.io/v3/`;
      const chain = chainBuilder()
        .with('rpcUri', rpcUriBuilder().with('value', rpcUriValue).build())
        .build();
      configApiMock.getChain.mockResolvedValue(rawify(chain));

      const api = await target.getApi(chain.chainId);

      expect(api.chain?.rpcUrls.default.http[0]).not.toContain(infuraApiKey);
    });

    it('should not include the INFURA_API_KEY in the RPC URI for a RPC provider different from Infura', async () => {
      const chain = chainBuilder().build();
      configApiMock.getChain.mockResolvedValue(rawify(chain));

      const api = await target.getApi(chain.chainId);

      expect(api.chain?.rpcUrls.default.http[0]).not.toContain(infuraApiKey);
    });
  });

  describe('destroyApi', () => {
    it('clears the API', async () => {
      const chain = chainBuilder().build();
      configApiMock.getChain.mockResolvedValue(rawify(chain));

      const api = await target.getApi(chain.chainId);
      target.destroyApi(chain.chainId);
      const cachedApi = await target.getApi(chain.chainId);

      expect(api).not.toBe(cachedApi);
    });
  });

  describe('createCachedRpcClient', () => {
    it('caches string response RPC requests', async () => {
      const chain = chainBuilder().build();
      const client = target._createCachedRpcClient(chain);
      const fetchSpy = vi.spyOn(global, 'fetch');
      const chainId = toHex(chain.chainId);
      const rpcUrl = new URL(chain.rpcUri.value).toString();

      fetchSpy.mockImplementation((_: unknown) => {
        // Return chain ID
        return Promise.resolve(
          new Response(JSON.stringify({ result: chainId }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });
      const body = {
        jsonrpc: '2.0',
        method: 'eth_chainId',
      };
      const cacheDir = new CacheDir(
        `${chain.chainId}_rpc_requests`,
        `${body.method}_undefined`,
      );

      await expect(client.getChainId()).resolves.toBe(hexToNumber(chainId));

      // Should be cached
      await client.getChainId();
      await client.getChainId();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenNthCalledWith(1, rpcUrl, {
        body: expect.any(String),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: expect.any(AbortSignal),
        url: rpcUrl,
      });
      expect(
        JSON.parse(fetchSpy.mock.calls[0][1]?.body as string),
      ).toStrictEqual({ ...body, id: expect.any(Number) });
      expect(fakeCacheService.keyCount()).toBe(1);
      const cached = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cached as string)).toBe(chainId);

      fetchSpy.mockRestore();
    });

    it('caches non-string response RPC requests', async () => {
      const chain = chainBuilder().build();
      const client = target._createCachedRpcClient(chain);
      const fetchSpy = vi.spyOn(global, 'fetch');
      const blockByNumber = {
        baseFeePerGas: null,
        hash: null,
        logsBloom: null,
        nonce: null,
        number: null,
        totalDifficulty: null,
      };

      const rpcUrl = new URL(chain.rpcUri.value).toString();

      fetchSpy.mockImplementation((_: unknown) => {
        // Return block
        return Promise.resolve(
          new Response(JSON.stringify({ result: blockByNumber }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });
      const body = {
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      };
      const cacheDir = new CacheDir(
        `${chain.chainId}_rpc_requests`,
        `${body.method}_${JSON.stringify(body.params)}`,
      );

      await expect(client.getBlock()).resolves.toStrictEqual(
        // Object containing in order not to mock entire return type
        expect.objectContaining(blockByNumber),
      );

      // Should be cached
      await client.getBlock();
      await client.getBlock();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenNthCalledWith(1, rpcUrl, {
        body: expect.any(String),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: expect.any(AbortSignal),
        url: rpcUrl,
      });
      expect(
        JSON.parse(fetchSpy.mock.calls[0][1]?.body as string),
      ).toStrictEqual({ ...body, id: expect.any(Number) });
      expect(fakeCacheService.keyCount()).toBe(1);
      const cached = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cached as string)).toStrictEqual(blockByNumber);

      fetchSpy.mockRestore();
    });
  });

  describe('getUncachedApi', () => {
    it('queries the given RPC on every call and never touches the RPC cache', async () => {
      const rpcUri = faker.internet.url();
      const chain = chainBuilder().build();
      configApiMock.getChain.mockResolvedValue(rawify(chain));
      const hGetSpy = vi.spyOn(fakeCacheService, 'hGet');
      const hSetSpy = vi.spyOn(fakeCacheService, 'hSet');
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ jsonrpc: '2.0', id: 0, result: null }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ),
      );
      const hash = toHex(faker.number.bigInt(), { size: 32 });

      const client = await target.getUncachedApi({
        chainId: chain.chainId,
        rpcUri,
      });
      await expect(
        client.getTransactionReceipt({ hash }),
      ).rejects.toBeInstanceOf(TransactionReceiptNotFoundError);
      await expect(
        client.getTransactionReceipt({ hash }),
      ).rejects.toBeInstanceOf(TransactionReceiptNotFoundError);

      expect(configApiMock.getChain).toHaveBeenCalledWith(chain.chainId);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      // viem normalizes the URL before fetching it.
      const { href } = new URL(rpcUri);
      expect(fetchSpy).toHaveBeenNthCalledWith(1, href, expect.anything());
      expect(fetchSpy).toHaveBeenNthCalledWith(2, href, expect.anything());
      expect(hGetSpy).not.toHaveBeenCalled();
      expect(hSetSpy).not.toHaveBeenCalled();
      expect(fakeCacheService.keyCount()).toBe(0);

      fetchSpy.mockRestore();
    });

    it('falls back to the chain RPC without a given RPC', async () => {
      const rpcUriValue = `https://${faker.internet.domainWord()}.infura.io/v3/`;
      const chain = chainBuilder()
        .with(
          'rpcUri',
          rpcUriBuilder()
            .with('value', rpcUriValue)
            .with('authentication', RpcUriAuthentication.ApiKeyPath)
            .build(),
        )
        .build();
      configApiMock.getChain.mockResolvedValue(rawify(chain));
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ jsonrpc: '2.0', id: 0, result: null }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ),
      );
      const hash = toHex(faker.number.bigInt(), { size: 32 });

      const client = await target.getUncachedApi({ chainId: chain.chainId });
      await expect(
        client.getTransactionReceipt({ hash }),
      ).rejects.toBeInstanceOf(TransactionReceiptNotFoundError);

      expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(
        `${rpcUriValue}${infuraApiKey}`,
        expect.anything(),
      );

      fetchSpy.mockRestore();
    });
  });
});
