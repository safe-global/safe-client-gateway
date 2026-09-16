// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
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
  PolicyIndexerResponseSchema,
  ROW_FIELDS,
  RowLocationSchema,
} from '@/modules/policies/datasources/policy-indexer-response.schema';
import {
  type PolicyIndexerRows,
  PolicyIndexerRowsSchema,
} from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { type Raw, rawify } from '@/validation/entities/raw.entity';

/**
 * Reads current policy state from the Policy Indexer.
 *
 * The indexer aggregates the `AllowanceModule` logs into
 * current-state rows, so this client fetches state and never events: no log
 * replay, no payload decoding, no contract call.
 *
 * Reads are cached **per Safe** but fetched **in one request**.
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
   * Current policy state for {@link args.safes}.
   *
   * Looks up each Safe's cache first. Otherwise the Safes that missed are fetched from the indexer in
   * **one** request. Each Safe's policy state is cached under its own key, so
   * a later change to one Safe's policies invalidates only its entry.
   */
  public async getState(args: {
    safes: ReadonlyArray<SafeRef>;
  }): Promise<Raw<unknown>> {
    const cacheHits = await Promise.all(
      args.safes.map((safe) => this.cachedSlice(safe)),
    );
    const misses = args.safes.filter((_, index) => cacheHits[index] === null);

    if (misses.length === 0) {
      return rawify(
        this.mergePolicyIndexerRowss(
          cacheHits.filter((hit): hit is PolicyIndexerRows => hit !== null),
        ),
      );
    }

    const fetched = await this.fetch(misses);
    const policiesStates = await Promise.all(
      args.safes.map(async (safe, index) => {
        const hit = cacheHits[index];
        if (hit) {
          return hit;
        }

        const policiesState = this.filterPolicyIndexerRowsBySafe(fetched, safe);
        await this.cache(safe, policiesState);
        return policiesState;
      }),
    );

    return rawify(this.mergePolicyIndexerRowss(policiesStates));
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
  ): Promise<PolicyIndexerRows> {
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
  private queried(body: unknown): PolicyIndexerRows {
    const response = PolicyIndexerResponseSchema.parse(body);

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

  private async cachedSlice(safe: SafeRef): Promise<PolicyIndexerRows | null> {
    const cached = await this.cacheService.hGet(this.cacheDir(safe));

    if (!cached) {
      return null;
    }

    const parsed = PolicyIndexerRowsSchema.safeParse(this.parseJson(cached));

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

  private async cache(safe: SafeRef, slice: PolicyIndexerRows): Promise<void> {
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

  /**
   * Reassembles slices into one response.
   *
   * `_meta` is deduplicated by chain, since every slice of a chain carries it.
   */
  private mergePolicyIndexerRowss(
    slices: ReadonlyArray<PolicyIndexerRows>,
  ): PolicyIndexerRows {
    const merged: PolicyIndexerRows = {
      _meta: [],
      SafeAllowance: [],
      SafeDelegate: [],
    };
    const chains = new Set<number>();

    for (const slice of slices) {
      for (const meta of slice._meta) {
        const location = RowLocationSchema.safeParse(meta);
        if (location.success && !chains.has(location.data.chainId)) {
          chains.add(location.data.chainId);
          merged._meta.push(meta);
        }
      }
      for (const field of ROW_FIELDS) {
        merged[field].push(...slice[field]);
      }
    }

    return merged;
  }

  /**
   * The row(s) of {@link response} belonging to {@link safe}.
   */
  private filterPolicyIndexerRowsBySafe(
    response: PolicyIndexerRows,
    safe: SafeRef,
  ): PolicyIndexerRows {
    const belongsToChain = (row: unknown): boolean => {
      const location = RowLocationSchema.safeParse(row);
      return location.success && String(location.data.chainId) === safe.chainId;
    };
    const belongsToSafe = (row: unknown): boolean => {
      const location = RowLocationSchema.safeParse(row);
      return (
        location.success &&
        String(location.data.chainId) === safe.chainId &&
        location.data.safe?.toLowerCase() === safe.address.toLowerCase()
      );
    };

    const slice: PolicyIndexerRows = {
      _meta: response._meta.filter(belongsToChain),
      SafeAllowance: [],
      SafeDelegate: [],
    };

    for (const field of ROW_FIELDS) {
      slice[field] = response[field].filter(belongsToSafe);
    }

    return slice;
  }
}
