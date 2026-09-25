// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { PolicyIndexerApi } from '@/modules/policies/datasources/policy-indexer-api.service';
import type { RawIndexerMeta } from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import {
  rawIndexerMetaBuilder,
  rawPolicyIndexerResponse,
} from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import {
  rawIndexerSafeAllowanceBuilder,
  rawIndexerSafeDelegateBuilder,
} from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import { rawify } from '@/validation/entities/raw.entity';

const mockNetworkService = {
  post: vi.fn(),
} as MockedObject<INetworkService>;

const mockCacheService = {
  hGet: vi.fn(),
  hSet: vi.fn(),
  deleteByKey: vi.fn(),
  getInvalidationTimeMs: vi.fn(),
} as unknown as MockedObject<ICacheService>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const SEPOLIA = '11155111';
const POLYGON = '137';
const baseUri = 'https://indexer.example';
const expirationTimeSeconds = 60;

type RawPolicyIndexerStateOverrides = Parameters<
  typeof rawPolicyIndexerResponse
>[0];

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

/** The indexing-progress row of one chain. */
function meta(chainId: string): RawIndexerMeta {
  return rawIndexerMetaBuilder().with('chainId', Number(chainId)).build();
}

/** A well-formed 200, carrying the state the indexer would have served. */
function mockIndexerState(rows?: RawPolicyIndexerStateOverrides): void {
  mockNetworkService.post.mockResolvedValue({
    status: 200,
    data: rawify({ data: rawPolicyIndexerResponse(rows) }),
  });
}

/** A 200 whose body carries GraphQL errors in place of data. */
function mockGraphQlErrors(...messages: Array<string>): void {
  mockNetworkService.post.mockResolvedValue({
    status: 200,
    data: rawify({ errors: messages.map((message) => ({ message })) }),
  });
}

describe('PolicyIndexerApi', () => {
  let target: PolicyIndexerApi;

  beforeEach(() => {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('policies.indexer.baseUri', baseUri);
    fakeConfigurationService.set(
      'expirationTimeInSeconds.policyIndexer',
      expirationTimeSeconds,
    );

    mockCacheService.hGet.mockResolvedValue(null);
    mockCacheService.getInvalidationTimeMs.mockResolvedValue(null);
    mockIndexerState();

    target = new PolicyIndexerApi(
      fakeConfigurationService,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
      new HttpErrorFactory(),
    );
  });

  /** A read of one Sepolia Safe, for the cases that do not care which. */
  function readOneSafe(): Promise<Raw<unknown>> {
    return target.getState({ safes: [safeRef(SEPOLIA)] });
  }

  describe('get policies request', () => {
    it('should post the state query to the GraphQL endpoint', async () => {
      await readOneSafe();

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
      await readOneSafe();

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
  });

  describe('failures', () => {
    it('should fail on a GraphQL errors body served with a 200', async () => {
      // The transport succeeded, so nothing below this layer would notice.
      mockGraphQlErrors('field "safe" not found');

      await expect(readOneSafe()).rejects.toThrow('Service unavailable');
    });

    it('should log the GraphQL messages, which the funnel does not carry', async () => {
      mockGraphQlErrors('field "safe" not found');

      await expect(readOneSafe()).rejects.toThrow('Service unavailable');
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

      await expect(readOneSafe()).rejects.toThrow('Service unavailable');
    });

    it('should propagate a network failure', async () => {
      mockNetworkService.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(readOneSafe()).rejects.toThrow('Service unavailable');
    });

    it('should not cache a failed read', async () => {
      mockNetworkService.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(readOneSafe()).rejects.toThrow('Service unavailable');
      expect(mockCacheService.hSet).not.toHaveBeenCalled();
    });
  });

  describe('caching', () => {
    it('should read a cached safe without calling indexer service', async () => {
      const slice = rawPolicyIndexerResponse({
        SafeDelegate: [rawIndexerSafeDelegateBuilder().build()],
      });
      mockCacheService.hGet.mockResolvedValue(JSON.stringify(slice));

      const result = await readOneSafe();

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
            ? JSON.stringify(rawPolicyIndexerResponse())
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
      const sepoliaMeta = meta(SEPOLIA);
      const myRow = rawIndexerSafeAllowanceBuilder()
        .with('safe', mine.address)
        .build();
      mockIndexerState({
        _meta: [sepoliaMeta],
        SafeAllowance: [
          myRow,
          rawIndexerSafeAllowanceBuilder().with('safe', other.address).build(),
        ],
      });

      await target.getState({ safes: [mine, other] });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        new CacheDir(cacheKey(mine), ''),
        JSON.stringify(
          rawPolicyIndexerResponse({
            _meta: [sepoliaMeta],
            SafeAllowance: [myRow],
          }),
        ),
        expirationTimeSeconds,
      );
    });

    it('should cache a safe that holds no policies as an empty slice', async () => {
      // The negative cache: without it every read for an unconfigured Safe goes
      // upstream again.
      const safe = safeRef(SEPOLIA);
      const sepoliaMeta = meta(SEPOLIA);
      mockIndexerState({ _meta: [sepoliaMeta] });

      await target.getState({ safes: [safe] });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        new CacheDir(cacheKey(safe), ''),
        JSON.stringify(rawPolicyIndexerResponse({ _meta: [sepoliaMeta] })),
        expirationTimeSeconds,
      );
    });

    it('should give a safe the indexing progress of its own chain only', async () => {
      const sepoliaMeta = meta(SEPOLIA);
      mockIndexerState({ _meta: [sepoliaMeta, meta(POLYGON)] });

      const result = await readOneSafe();

      expect(result).toStrictEqual(
        expect.objectContaining({ _meta: [sepoliaMeta] }),
      );
    });

    it('should report the progress of every chain it was asked about', async () => {
      const sepoliaMeta = meta(SEPOLIA);
      const polygonMeta = meta(POLYGON);
      mockIndexerState({ _meta: [sepoliaMeta, polygonMeta] });

      const result = await target.getState({
        safes: [safeRef(SEPOLIA), safeRef(POLYGON)],
      });

      expect(result).toStrictEqual(
        expect.objectContaining({ _meta: [sepoliaMeta, polygonMeta] }),
      );
    });

    it.each([
      [
        'an entry of an older shape',
        JSON.stringify({ shape: 'older release' }),
      ],
      ['malformed JSON', '{not json'],
    ])('should treat %s as a miss', async (_, cached) => {
      mockCacheService.hGet.mockResolvedValue(cached);

      await readOneSafe();

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
    });

    it('should not cache a safe cleared while its fetch was in flight', async () => {
      // The answer in flight predates the transaction that cleared the Safe;
      // writing it back would undo the invalidation for a full expiration
      // window.
      const safe = safeRef(SEPOLIA);
      mockCacheService.getInvalidationTimeMs.mockImplementation((key: string) =>
        Promise.resolve(key === cacheKey(safe) ? Date.now() : null),
      );

      await target.getState({ safes: [safe] });

      expect(mockCacheService.hSet).not.toHaveBeenCalled();
    });

    it('should serve the fetched state of a safe cleared mid-fetch', async () => {
      // Only the write is skipped: the caller still gets what was fetched.
      const safe = safeRef(SEPOLIA);
      const sepoliaMeta = meta(SEPOLIA);
      mockIndexerState({ _meta: [sepoliaMeta] });
      mockCacheService.getInvalidationTimeMs.mockResolvedValue(Date.now());

      const result = await target.getState({ safes: [safe] });

      expect(result).toStrictEqual(
        rawPolicyIndexerResponse({ _meta: [sepoliaMeta] }),
      );
    });

    it('should cache a safe whose last invalidation predates the fetch', async () => {
      const safe = safeRef(SEPOLIA);
      mockCacheService.getInvalidationTimeMs.mockResolvedValue(
        Date.now() - faker.number.int({ min: 1000, max: 10_000 }),
      );

      await target.getState({ safes: [safe] });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        new CacheDir(cacheKey(safe), ''),
        expect.any(String),
        expirationTimeSeconds,
      );
    });

    it('should cache the other safes of a request when one was cleared mid-fetch', async () => {
      // Each Safe carries its own marker, so a transaction on one does not
      // discard the rest of the batch.
      const cleared = safeRef(SEPOLIA);
      const untouched = safeRef(POLYGON);
      mockCacheService.getInvalidationTimeMs.mockImplementation((key: string) =>
        Promise.resolve(key === cacheKey(cleared) ? Date.now() : null),
      );

      await target.getState({ safes: [cleared, untouched] });

      expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        new CacheDir(cacheKey(untouched), ''),
        expect.any(String),
        expirationTimeSeconds,
      );
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
