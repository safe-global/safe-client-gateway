import { Inject, Injectable } from '@nestjs/common';
import { isAddressEqual, type Address } from 'viem';
import chunk from 'lodash/chunk';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import { SafeSchema } from '@/modules/safe/domain/entities/schemas/safe.schema';
import type { BaseDataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { DeadlockAnalysisResponse } from '../entities/analysis-responses.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { DeadlockStatus } from './entities/deadlock-status.entity';
import { DeadlockStatusGroup } from '../entities/status-group.entity';
import {
  DEADLOCK_SEVERITY_MAPPING,
  DEADLOCK_TITLE_MAPPING,
  DEADLOCK_DESCRIPTION_MAPPING,
} from './entities/deadlock-status.constants';
import {
  isOwnerConfigTransaction,
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

  async analyze(args: {
    chainId: string;
    safeAddress: Address;
    transactions: Array<DecodedTransactionData>;
  }): Promise<DeadlockAnalysisResponse> {
    const { chainId, safeAddress, transactions } = args;

    // Find all owner configuration transactions targeting the Safe itself
    const ownerConfigTxs = transactions.filter(
      (tx) =>
        isAddressEqual(tx.to, safeAddress) &&
        isOwnerConfigTransaction(tx.dataDecoded),
    );

    if (ownerConfigTxs.length === 0) {
      return {};
    }
    const ownerConfigs = ownerConfigTxs.map((tx) => tx.dataDecoded!);

    const cacheDir = CacheRouter.getDeadlockAnalysisCacheDir({
      chainId,
      safeAddress,
      dataDecoded: ownerConfigs,
    });

    const cached = await this.cacheService.hGet(cacheDir);
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

  private async performAnalysis(
    chainId: string,
    safeAddress: Address,
    ownerConfigs: Array<BaseDataDecoded>,
  ): Promise<DeadlockAnalysisResponse> {
    const transactionApi = await this.transactionApiManager.getApi(chainId);

    const projected = await this.fetchProjectedState(
      transactionApi,
      safeAddress,
      ownerConfigs,
    );

    const safeOwnerResults = await this.batchProcess(
      projected.owners,
      async (address) => {
        try {
          const raw = await transactionApi.getSafe(address);
          const safe = SafeSchema.parse(raw);
          return { address, owners: safe.owners, threshold: safe.threshold };
        } catch (error) {
          if (error instanceof DataSourceError && error.code === 404) {
            return null; // Not a Safe — treat as EOA
          }
          throw error; // API failure — will become 'rejected' in allSettled
        }
      },
    );

    const hasApiFailure = safeOwnerResults.some((r) => r.status === 'rejected');
    if (hasApiFailure) {
      return this.buildResponse(DeadlockStatus.DEADLOCK_UNKNOWN);
    }

    const hasSafeOwners = safeOwnerResults.some(
      (r) => r.status === 'fulfilled' && r.value !== null,
    );
    if (!hasSafeOwners) {
      return this.buildResponse(DeadlockStatus.NO_DEADLOCK);
    }

    const { deadlockDetected, nestedCandidates } = this.checkMutualDependencies(
      safeOwnerResults,
      safeAddress,
      projected,
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

    return this.buildResponse(DeadlockStatus.NO_DEADLOCK);
  }

  private async fetchProjectedState(
    transactionApi: ITransactionApi,
    safeAddress: Address,
    ownerConfigs: Array<BaseDataDecoded>,
  ): Promise<{ owners: Array<Address>; threshold: number }> {
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

  private checkMutualDependencies(
    safeOwnerResults: Array<
      PromiseSettledResult<{
        address: Address;
        owners: Array<Address>;
        threshold: number;
      } | null>
    >,
    safeAddress: Address,
    projected: { owners: Array<Address>; threshold: number },
  ): {
    deadlockDetected: boolean;
    nestedCandidates: Set<Address>;
  } {
    let deadlockDetected = false;
    const nestedCandidates = new Set<Address>();

    for (const result of safeOwnerResults) {
      if (result.status !== 'fulfilled' || result.value === null) {
        continue;
      }

      const ownerSafe = result.value;

      const hasMutualDep = ownerSafe.owners.some((o) =>
        isAddressEqual(o, safeAddress),
      );

      if (hasMutualDep) {
        const targetNonDependent = projected.owners.filter(
          (o) => !isAddressEqual(o, ownerSafe.address),
        ).length;
        const ownerNonDependent = ownerSafe.owners.filter(
          (o) => !isAddressEqual(o, safeAddress),
        ).length;

        if (
          targetNonDependent < projected.threshold &&
          ownerNonDependent < ownerSafe.threshold
        ) {
          deadlockDetected = true;
          return { deadlockDetected, nestedCandidates };
        }
      }

      for (const o of ownerSafe.owners) {
        if (!isAddressEqual(o, safeAddress)) {
          nestedCandidates.add(o);
        }
      }
    }

    return { deadlockDetected, nestedCandidates };
  }

  private async checkNestedSafes(
    transactionApi: ITransactionApi,
    candidates: Array<Address>,
  ): Promise<boolean> {
    const results = await this.batchProcess(candidates, (addr) =>
      transactionApi.isSafe(addr),
    );
    return results.some((r) => r.status === 'fulfilled' && r.value);
  }

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
