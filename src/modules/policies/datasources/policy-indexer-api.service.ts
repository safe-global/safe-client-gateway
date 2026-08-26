// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CircuitBreakerKeys } from '@/datasources/circuit-breaker/circuit-breaker.keys';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  POLICY_INDEXER_STATE_QUERY,
  toPolicyIndexerVariables,
} from '@/modules/policies/datasources/policy-indexer.query';
import {
  mergeSlices,
  type PolicyStateSlice,
  PolicyStateSliceSchema,
  sliceForSafe,
} from '@/modules/policies/datasources/policy-state.slice';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { type Raw, rawify } from '@/validation/entities/raw.entity';

/**
 * A GraphQL response envelope. Transport-level, so it is parsed here rather than
 * modelled as a domain entity: `data` stays opaque for the repository to parse.
 */
const GraphQlResponseSchema = z.object({
  data: PolicyStateSliceSchema.optional(),
  errors: z
    .array(z.object({ message: z.string().optional() }))
    .nonempty()
    .optional(),
});

/**
 * Reads current policy state from the Policy Indexer.
 *
 * The indexer aggregates the `SafePolicyGuard` and `AllowanceModule` logs into
 * current-state rows, so this client fetches state and never events: no log
 * replay, no payload decoding, no contract call.
 *
 * Reads are cached **per Safe** but fetched **in one request**: a Space-level
 * read of ten Safes with nine of them cached fetches one. Caching the set
 * instead would be simpler and could not be invalidated - a policy change on one
 * Safe has no way to name every cached set that contains it.
 */
@Injectable()
export class PolicyIndexerApi {
  private readonly baseUri: string;
  private readonly expirationTimeSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri = this.configurationService.getOrThrow<string>(
      'policies.indexer.baseUri',
    );
    this.expirationTimeSeconds = this.configurationService.getOrThrow<number>(
      'expirationTimeInSeconds.policyIndexer',
    );
  }

  /**
   * Current policy state for {@link safes}, unvalidated.
   *
   * @throws when the indexer is unreachable, answers non-2xx, or answers `200`
   * with a GraphQL `errors` body. A Safe that simply holds no policies is an
   * empty slice, which is cached like any other answer.
   */
  public async getState(args: {
    safes: ReadonlyArray<SafeRef>;
  }): Promise<Raw<unknown>> {
    if (args.safes.length === 0) {
      // `_or: []` is false in the indexer's filter language, so an empty request
      // would return nothing rather than failing - indistinguishable from a set
      // of Safes that hold no policies. Callers must not ask.
      throw new Error('At least one Safe is required to read policy state');
    }

    const cached = await Promise.all(
      args.safes.map((safe) => this.cachedSlice(safe)),
    );
    const misses = args.safes.filter((_, index) => cached[index] === null);
    const fetched = misses.length > 0 ? await this.fetch(misses) : null;
    const slices = await Promise.all(
      args.safes.map(async (safe, index) => {
        const hit = cached[index];
        if (hit) {
          return hit;
        }
        // `fetched` is non-null whenever a Safe missed the cache, since that is
        // what made `misses` non-empty.
        const slice = sliceForSafe(fetched ?? emptySlice(), safe);
        await this.cache(safe, slice);
        return slice;
      }),
    );

    return rawify(mergeSlices(slices));
  }

  /**
   * Forgets the policy state of one Safe, so the next read goes upstream.
   *
   * Called from the transaction hooks: every policy change is a Safe
   * transaction, and an allowance transfer moves `spent` without changing any
   * configuration at all.
   */
  public async clearState(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    await this.cacheService.deleteByKey(
      CacheRouter.getPolicyIndexerStateCacheKey(args),
    );
  }

  /**
   * One request for every Safe that missed the cache.
   */
  private async fetch(
    safes: ReadonlyArray<SafeRef>,
  ): Promise<PolicyStateSlice> {
    try {
      const { data } = await this.networkService.post<unknown>({
        url: `${this.baseUri}/v1/graphql`,
        data: {
          query: POLICY_INDEXER_STATE_QUERY,
          variables: toPolicyIndexerVariables(safes),
        },
        networkRequest: {
          circuitBreaker: { key: CircuitBreakerKeys.getPolicyIndexerKey() },
        },
      });

      return this.queried(data);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * GraphQL reports a failed query as `errors` inside a `200`, so nothing below
   * this layer would notice one.
   *
   * The messages are logged rather than raised: an unreadable query is an
   * upstream fault, so the caller gets the funnel's generic error while the
   * detail that identifies the fault stays in the logs.
   */
  private queried(body: unknown): PolicyStateSlice {
    const response = GraphQlResponseSchema.parse(body);

    if (response.errors) {
      this.loggingService.error({
        message: 'Policy indexer query failed',
        errors: response.errors.map(
          (error) => error.message ?? 'unknown error',
        ),
      });
      throw new Error('Policy indexer query failed');
    }

    if (!response.data) {
      throw new Error('Policy indexer answered without data');
    }

    return response.data;
  }

  private async cachedSlice(safe: SafeRef): Promise<PolicyStateSlice | null> {
    const cached = await this.cacheService.hGet(this.cacheDir(safe));

    if (!cached) {
      return null;
    }

    const parsed = PolicyStateSliceSchema.safeParse(this.parseJson(cached));

    if (!parsed.success) {
      // A shape written by an older release. Treat it as a miss rather than
      // failing the read; the fresh answer overwrites it.
      this.loggingService.debug({
        message: 'Discarded an unreadable cached policy state',
        chainId: safe.chainId,
        safeAddress: safe.address,
      });
      return null;
    }

    return parsed.data;
  }

  private async cache(safe: SafeRef, slice: PolicyStateSlice): Promise<void> {
    await this.cacheService.hSet(
      this.cacheDir(safe),
      JSON.stringify(slice),
      this.expirationTimeSeconds,
    );
  }

  private cacheDir(
    safe: SafeRef,
  ): ReturnType<typeof CacheRouter.getPolicyIndexerStateCacheDir> {
    return CacheRouter.getPolicyIndexerStateCacheDir({
      chainId: safe.chainId,
      safeAddress: safe.address,
    });
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

function emptySlice(): PolicyStateSlice {
  return { _meta: [], SafeAllowance: [], SafeDelegate: [], SafePolicy: [] };
}
