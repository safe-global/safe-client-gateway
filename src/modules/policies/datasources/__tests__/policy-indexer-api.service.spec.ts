// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { PolicyIndexerApi } from '@/modules/policies/datasources/policy-indexer-api.service';
import {
  rawIndexerMetaBuilder,
  rawPolicyIndexerState,
} from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import {
  rawIndexerSafeAllowanceBuilder,
  rawIndexerSafeDelegateBuilder,
} from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { rawify } from '@/validation/entities/raw.entity';

const mockNetworkService = {
  post: vi.fn(),
} as MockedObject<INetworkService>;

const mockCacheService = {
  hGet: vi.fn(),
  hSet: vi.fn(),
  deleteByKey: vi.fn(),
} as unknown as MockedObject<ICacheService>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const mockConfigurationService = {
  get: vi.fn(),
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

const SEPOLIA = '11155111';
const POLYGON = '137';
const baseUri = 'https://indexer.example';
const expirationTimeSeconds = 60;

function safeRef(chainId: string): SafeRef {
  return { chainId, address: getAddress(faker.finance.ethereumAddress()) };
}

/** The `_or` group the query carries for one chain's safes. */
function pairGroup(chainId: string, ...safes: Array<SafeRef>) {
  return {
    chainId: { _eq: Number(chainId) },
    safe: { _in: safes.map((safe) => safe.address) },
  };
}

/** A request whose filters are exactly {@link groups}, for every root field. */
function requestWith(groups: Array<ReturnType<typeof pairGroup>>): object {
  return expect.objectContaining({
    data: expect.objectContaining({
      variables: { allowances: groups, delegates: groups },
    }),
  });
}

function cacheKey(safe: SafeRef): string {
  return `${safe.chainId}_policy_indexer_state_${safe.address}`;
}

describe('PolicyIndexerApi', () => {
  let target: PolicyIndexerApi;

  beforeEach(() => {
    mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'policies.indexer.baseUri') return baseUri;
      if (key === 'expirationTimeInSeconds.policyIndexer')
        return expirationTimeSeconds;
      throw new Error(`Unexpected key: ${key}`);
    });
    mockCacheService.hGet.mockResolvedValue(null);
    mockNetworkService.post.mockResolvedValue({
      status: 200,
      data: rawify({ data: rawPolicyIndexerState() }),
    });
    target = new PolicyIndexerApi(
      mockConfigurationService,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
      new HttpErrorFactory(),
    );
  });

  describe('the request', () => {
    it('should post the state query to the GraphQL endpoint', async () => {
      await target.getState({ safes: [safeRef(SEPOLIA)] });

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
      expect(mockNetworkService.post).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${baseUri}/v1/graphql`,
          networkRequest: { circuitBreaker: { key: 'policy-indexer' } },
        }),
      );
    });

    it('should request the allowance-module fields in one document', async () => {
      // Guard bindings are a field this client does not pay for; the PR that
      // reports them adds it.
      await target.getState({ safes: [safeRef(SEPOLIA)] });

      expect(mockNetworkService.post).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            query: expect.stringContaining('query PolicyIndexerState'),
          }),
        }),
      );
      for (const field of ['_meta', 'SafeAllowance', 'SafeDelegate']) {
        expect(mockNetworkService.post).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              query: expect.stringContaining(field),
            }),
          }),
        );
      }
    });

    it('should issue one request for many safes on many chains', async () => {
      const sepolia = safeRef(SEPOLIA);
      const polygon = safeRef(POLYGON);

      await target.getState({ safes: [sepolia, polygon] });

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
    });

    it('should group the pairs per chain rather than crossing them', async () => {
      // A flat chainId/safe pair of `_in` filters is a cross-product: it would
      // return rows for a Safe on a chain it is not held on.
      const sepoliaOne = safeRef(SEPOLIA);
      const sepoliaTwo = safeRef(SEPOLIA);
      const polygon = safeRef(POLYGON);

      await target.getState({ safes: [sepoliaOne, polygon, sepoliaTwo] });

      expect(mockNetworkService.post).toHaveBeenCalledWith(
        requestWith([
          pairGroup(SEPOLIA, sepoliaOne, sepoliaTwo),
          pairGroup(POLYGON, polygon),
        ]),
      );
    });

    it('should reject a request without safes instead of asking for everything', async () => {
      // `_or: []` is false in the filter language, so an empty request would
      // return nothing and look like a set of Safes with no policies.
      await expect(target.getState({ safes: [] })).rejects.toThrow(
        'At least one Safe is required to read policy state',
      );
      expect(mockNetworkService.post).not.toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    it('should fail on a GraphQL errors body served with a 200', async () => {
      // The transport succeeded, so nothing below this layer would notice.
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: rawify({ errors: [{ message: 'field "safe" not found' }] }),
      });

      await expect(
        target.getState({ safes: [safeRef(SEPOLIA)] }),
      ).rejects.toThrow('Service unavailable');
    });

    it('should log the GraphQL messages, which the funnel does not carry', async () => {
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: rawify({ errors: [{ message: 'field "safe" not found' }] }),
      });

      await expect(
        target.getState({ safes: [safeRef(SEPOLIA)] }),
      ).rejects.toThrow('Service unavailable');

      expect(mockLoggingService.error).toHaveBeenCalledWith({
        message: 'Policy indexer query failed',
        errors: ['field "safe" not found'],
      });
    });

    it('should fail on a 200 that carries neither data nor errors', async () => {
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: rawify({}),
      });

      await expect(
        target.getState({ safes: [safeRef(SEPOLIA)] }),
      ).rejects.toThrow('Service unavailable');
    });

    it('should propagate a network failure', async () => {
      mockNetworkService.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        target.getState({ safes: [safeRef(SEPOLIA)] }),
      ).rejects.toThrow('Service unavailable');
    });

    it('should not cache a failed read', async () => {
      mockNetworkService.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        target.getState({ safes: [safeRef(SEPOLIA)] }),
      ).rejects.toThrow('Service unavailable');
      expect(mockCacheService.hSet).not.toHaveBeenCalled();
    });
  });

  describe('caching', () => {
    it('should read a cached safe without going upstream', async () => {
      const slice = rawPolicyIndexerState({
        SafeDelegate: [rawIndexerSafeDelegateBuilder().build()],
      });
      mockCacheService.hGet.mockResolvedValue(JSON.stringify(slice));

      const result = await target.getState({ safes: [safeRef(SEPOLIA)] });

      expect(mockNetworkService.post).not.toHaveBeenCalled();
      expect(result).toStrictEqual(slice);
    });

    it('should fetch only the safes that missed, in one request', async () => {
      // The point of caching per Safe while fetching per set: a Space read of
      // ten Safes with nine cached fetches one.
      const cached = safeRef(SEPOLIA);
      const missed = safeRef(SEPOLIA);
      mockCacheService.hGet.mockImplementation((cacheDir: CacheDir) =>
        Promise.resolve(
          cacheDir.key === cacheKey(cached)
            ? JSON.stringify(rawPolicyIndexerState())
            : null,
        ),
      );

      await target.getState({ safes: [cached, missed] });

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
      expect(mockNetworkService.post).toHaveBeenCalledWith(
        requestWith([pairGroup(SEPOLIA, missed)]),
      );
    });

    it('should cache each fetched safe under its own key, with the configured expiration', async () => {
      const sepolia = safeRef(SEPOLIA);
      const polygon = safeRef(POLYGON);

      await target.getState({ safes: [sepolia, polygon] });

      expect(mockCacheService.hSet).toHaveBeenCalledTimes(2);
      for (const safe of [sepolia, polygon]) {
        expect(mockCacheService.hSet).toHaveBeenCalledWith(
          new CacheDir(cacheKey(safe), ''),
          expect.any(String),
          expirationTimeSeconds,
        );
      }
    });

    it('should give each safe only its own rows', async () => {
      // Cached per Safe, so a slice carrying another Safe's rows would keep
      // serving them after that Safe changed.
      const mine = safeRef(SEPOLIA);
      const other = safeRef(SEPOLIA);
      const meta = rawIndexerMetaBuilder().with('chainId', 11155111).build();
      const myRow = rawIndexerSafeAllowanceBuilder()
        .with('safe', mine.address)
        .build();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: rawify({
          data: rawPolicyIndexerState({
            _meta: [meta],
            SafeAllowance: [
              myRow,
              rawIndexerSafeAllowanceBuilder()
                .with('safe', other.address)
                .build(),
            ],
          }),
        }),
      });

      await target.getState({ safes: [mine, other] });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        new CacheDir(cacheKey(mine), ''),
        JSON.stringify({
          _meta: [meta],
          SafeAllowance: [myRow],
          SafeDelegate: [],
        }),
        expirationTimeSeconds,
      );
    });

    it('should cache a safe that holds no policies as an empty slice', async () => {
      // The negative cache: without it every read for an unconfigured Safe goes
      // upstream again.
      const safe = safeRef(SEPOLIA);
      const meta = rawIndexerMetaBuilder().with('chainId', 11155111).build();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: rawify({ data: rawPolicyIndexerState({ _meta: [meta] }) }),
      });

      await target.getState({ safes: [safe] });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        new CacheDir(cacheKey(safe), ''),
        JSON.stringify({ _meta: [meta], SafeAllowance: [], SafeDelegate: [] }),
        expirationTimeSeconds,
      );
    });

    it('should give a safe the indexing progress of its own chain only', async () => {
      const sepolia = rawIndexerMetaBuilder().with('chainId', 11155111).build();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: rawify({
          data: rawPolicyIndexerState({
            _meta: [
              sepolia,
              rawIndexerMetaBuilder().with('chainId', 137).build(),
            ],
          }),
        }),
      });

      const result = await target.getState({ safes: [safeRef(SEPOLIA)] });

      expect(result).toStrictEqual(
        expect.objectContaining({ _meta: [sepolia] }),
      );
    });

    it('should report the progress of every chain it was asked about', async () => {
      const sepoliaMeta = rawIndexerMetaBuilder()
        .with('chainId', 11155111)
        .build();
      const polygonMeta = rawIndexerMetaBuilder().with('chainId', 137).build();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: rawify({
          data: rawPolicyIndexerState({ _meta: [sepoliaMeta, polygonMeta] }),
        }),
      });

      const result = await target.getState({
        safes: [safeRef(SEPOLIA), safeRef(POLYGON)],
      });

      expect(result).toStrictEqual(
        expect.objectContaining({ _meta: [sepoliaMeta, polygonMeta] }),
      );
    });

    it('should treat a cached entry of an older shape as a miss', async () => {
      mockCacheService.hGet.mockResolvedValue(
        JSON.stringify({ shape: 'from an older release' }),
      );

      await target.getState({ safes: [safeRef(SEPOLIA)] });

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
    });

    it('should treat malformed cached JSON as a miss', async () => {
      mockCacheService.hGet.mockResolvedValue('{not json');

      await target.getState({ safes: [safeRef(SEPOLIA)] });

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
    });

    it('should forget one safe on clearState', async () => {
      const safe = safeRef(SEPOLIA);

      await target.clearState({
        chainId: safe.chainId,
        safeAddress: safe.address,
      });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(cacheKey(safe));
    });
  });
});
