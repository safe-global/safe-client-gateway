// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { isAddressEqual, type Address } from 'viem';
import chunk from 'lodash/chunk';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import { SafeSchema } from '@/modules/safe/domain/entities/schemas/safe.schema';
import type { BaseDataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { DeadlockAnalysisResponse } from '../entities/analysis-responses.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { DeadlockStatus } from '../entities/deadlock-status.entity';
import { DeadlockStatusGroup } from '../entities/status-group.entity';
import {
  DEADLOCK_SEVERITY_MAPPING,
  DEADLOCK_TITLE_MAPPING,
  DEADLOCK_DESCRIPTION_MAPPING,
} from './deadlock-status.constants';
import {
  extractOwnerConfigs,
  computeProjectedState,
} from './utils/owner-config-decoder.utils';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { logCacheHit, logCacheMiss } from '@/modules/safe-shield/utils/common';

type SafeOwnerInfo = {
  address: Address;
  owners: Array<Address>;
  threshold: number;
};

@Injectable()
export class DeadlockAnalysisService {
  private static readonly MAX_BATCH_SIZE = 20;
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  /**
   * Analyzes a batch of transactions for potential signing deadlocks.
   *
   * Filters for owner configuration transactions (addOwner, removeOwner, swapOwner,
   * changeThreshold) targeting the Safe itself, then checks whether the projected
   * state would create a mutual ownership cycle that prevents signing.
   * Results are cached to avoid redundant API calls.
   */
  async analyze(args: {
    chainId: string;
    safeAddress: Address;
    transactions: Array<DecodedTransactionData>;
  }): Promise<DeadlockAnalysisResponse> {
    const { chainId, safeAddress, transactions } = args;

    const ownerConfigs = extractOwnerConfigs(transactions, safeAddress);
    if (ownerConfigs.length === 0) {
      return {};
    }

    const cacheDir = CacheRouter.getDeadlockAnalysisCacheDir({
      chainId,
      safeAddress,
      dataDecoded: ownerConfigs,
    });

    const cached = await this.cacheService.hGet(cacheDir).catch(() => null);
    if (cached) {
      logCacheHit(cacheDir, this.loggingService);
      try {
        return JSON.parse(cached) as DeadlockAnalysisResponse;
      } catch (error) {
        this.loggingService.warn(
          `Failed to parse cached deadlock analysis results for ${JSON.stringify(cacheDir)}: ${error}`,
        );
      }
    }
    logCacheMiss(cacheDir, this.loggingService);

    const result = await this.performAnalysis(
      chainId,
      safeAddress,
      ownerConfigs,
    );

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(result),
      this.defaultExpirationTimeInSeconds,
    );

    return result;
  }

  /**
   * Core analysis logic: fetches the projected Safe state after applying queued
   * owner config transactions, looks up which owners are themselves Safes, and
   * checks for mutual ownership deadlocks at depth 1 and nested Safe presence
   * at depth 2.
   */
  private async performAnalysis(
    chainId: string,
    safeAddress: Address,
    ownerConfigs: Array<BaseDataDecoded>,
  ): Promise<DeadlockAnalysisResponse> {
    const transactionApi = await this.transactionApiManager.getApi(chainId);

    const projectedSafeState = await this.fetchProjectedState(
      transactionApi,
      safeAddress,
      ownerConfigs,
    );

    const ownersThatAreSafesLookupResults = await this.batchProcess(
      projectedSafeState.owners,
      async (address) => {
        try {
          const raw = await transactionApi.getSafe(address);
          const safe = SafeSchema.parse(raw);
          return { address, owners: safe.owners, threshold: safe.threshold } as SafeOwnerInfo;
        } catch (error) {
          if (error instanceof DataSourceError && error.code === 404) {
            return null; // Not a Safe — treat as EOA
          }
          throw error; // API failure — will become 'rejected' in allSettled
        }
      },
    );

    if (ownersThatAreSafesLookupResults.some((r) => r.status === 'rejected')) {
      return this.buildResponse(DeadlockStatus.NESTED_SAFE_WARNING);
    }

    const ownersThatAreSafes = this.extractOwnersThatAreSafes(ownersThatAreSafesLookupResults);
    if (ownersThatAreSafes.length === 0) {
      return {};
    }

    const { deadlockDetected, nestedCandidates } = this.checkMutualDependencies(
      ownersThatAreSafes,
      safeAddress,
      projectedSafeState,
    );

    if (deadlockDetected) {
      return this.buildResponse(DeadlockStatus.DEADLOCK_DETECTED);
    }

    if (
      nestedCandidates.size > 0 &&
      (await this.checkNestedSafes(transactionApi, [...nestedCandidates]))
    ) {
      return this.buildResponse(DeadlockStatus.NESTED_SAFE_WARNING);
    }

    return {};
  }

  /**
   * Fetches the current Safe state and sequentially applies all queued owner
   * configuration changes to compute the projected owners list and threshold.
   */
  private async fetchProjectedState(
    transactionApi: ITransactionApi,
    safeAddress: Address,
    ownerConfigs: Array<BaseDataDecoded>,
  ): Promise<Omit<SafeOwnerInfo, 'address'>> {
    const rawSafe = await transactionApi.getSafe(safeAddress);
    const currentSafe = SafeSchema.parse(rawSafe);

    let state = {
      owners: currentSafe.owners,
      threshold: currentSafe.threshold,
    };
    for (const dataDecoded of ownerConfigs) {
      state = computeProjectedState({
        currentOwners: state.owners,
        currentThreshold: state.threshold,
        dataDecoded,
      });
    }
    return state;
  }

  /**
   * Checks for depth-1 mutual ownership deadlocks between the target Safe
   * and each of its Safe-type owners. Also collects sub-owners of Safe-type
   * owners as candidates for the depth-2 nested Safe check.
   */
  private checkMutualDependencies(
    ownersThatAreSafes: Array<SafeOwnerInfo>,
    safeAddress: Address,
    projectedSafeState: Omit<SafeOwnerInfo, 'address'>,
  ): {
    deadlockDetected: boolean;
    nestedCandidates: Set<Address>;
  } {
    const nestedCandidates = new Set<Address>();
    for (const ownerSafe of ownersThatAreSafes) {
      if (this.isDeadlocked(projectedSafeState, ownerSafe, safeAddress)) {
        return { deadlockDetected: true, nestedCandidates: new Set() };
      }
      for (const o of ownerSafe.owners) {
        if (!isAddressEqual(o, safeAddress)) {
          nestedCandidates.add(o);
        }
      }
    }

    return { deadlockDetected: false, nestedCandidates };
  }

  /**
   * Extracts successfully resolved Safe owner data, discarding
   * rejected results and null values (404 = not a Safe).
   */
  private extractOwnersThatAreSafes(
    results: Array<PromiseSettledResult<SafeOwnerInfo | null>>,
  ): Array<SafeOwnerInfo> {
    return results
      .filter(
        (r): r is PromiseFulfilledResult<SafeOwnerInfo> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value);
  }

  /**
   * Two Safes are deadlocked when:
   * 1. They each list the other as an owner (mutual dependency), AND
   * 2. Neither Safe has enough *other* owners to meet its threshold
   *    without the co-dependent Safe's signature.
   */
  private isDeadlocked(
    targetSafe: Omit<SafeOwnerInfo, 'address'>,
    ownerSafe: SafeOwnerInfo,
    safeAddress: Address,
  ): boolean {
    const hasMutualDep = ownerSafe.owners.some((o) =>
      isAddressEqual(o, safeAddress),
    );
    if (!hasMutualDep) {
      return false;
    }

    const targetNonDependent = targetSafe.owners.filter(
      (o) => !isAddressEqual(o, ownerSafe.address),
    ).length;
    const ownerNonDependent = ownerSafe.owners.filter(
      (o) => !isAddressEqual(o, safeAddress),
    ).length;

    return (
      targetNonDependent < targetSafe.threshold &&
      ownerNonDependent < ownerSafe.threshold
    );
  }

  /**
   * Checks whether any of the candidate addresses are themselves Safes,
   * indicating nested Safe ownership at depth 2 that cannot be fully verified.
   */
  private async checkNestedSafes(
    transactionApi: ITransactionApi,
    candidates: Array<Address>,
  ): Promise<boolean> {
    const results = await this.batchProcess(candidates, (addr) =>
      transactionApi.isSafe(addr),
    );
    return results.some((r) => r.status === 'fulfilled' && r.value);
  }

  /**
   * Processes items in batches using Promise.allSettled to avoid overwhelming
   * the transaction API. Each batch runs concurrently; batches run sequentially.
   */
  private async batchProcess<T, R>(
    items: Array<T>,
    fn: (item: T) => Promise<R>,
  ): Promise<Array<PromiseSettledResult<R>>> {
    const results: Array<PromiseSettledResult<R>> = [];
    for (const batch of chunk(items, DeadlockAnalysisService.MAX_BATCH_SIZE)) {
      const batchResults = await Promise.allSettled(batch.map(fn));
      results.push(...batchResults);
    }
    return results;
  }

  private buildResponse(status: DeadlockStatus): DeadlockAnalysisResponse {
    return {
      [DeadlockStatusGroup.DEADLOCK]: [
        {
          severity: DEADLOCK_SEVERITY_MAPPING[status],
          type: status,
          title: DEADLOCK_TITLE_MAPPING[status],
          description: DEADLOCK_DESCRIPTION_MAPPING[status],
        },
      ],
    };
  }
}
