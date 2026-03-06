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
  isOwnerChangeTransaction,
  computeProjectedState,
} from './utils/owner-change-decoder.utils';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
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

    // Find the owner configuration transaction targeting the Safe itself
    const ownerConfigTx = transactions.find(
      (tx) =>
        isAddressEqual(tx.to, safeAddress) &&
        isOwnerChangeTransaction(tx.dataDecoded),
    );

    if (!ownerConfigTx?.dataDecoded) {
      return {};
    }

    const cacheDir = CacheRouter.getDeadlockAnalysisCacheDir({
      chainId,
      safeAddress,
      dataDecoded: ownerConfigTx.dataDecoded,
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
      ownerConfigTx.dataDecoded,
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
    dataDecoded: BaseDataDecoded,
  ): Promise<DeadlockAnalysisResponse> {
    const transactionApi = await this.transactionApiManager.getApi(chainId);

    const projected = await this.fetchProjectedState(
      transactionApi,
      safeAddress,
      dataDecoded,
    );

    const safeOwnerAddresses = await this.identifySafeOwners(
      transactionApi,
      projected.owners,
    );

    if (safeOwnerAddresses.length === 0) {
      return this.buildResponse(DeadlockStatus.NO_DEADLOCK);
    }

    const safeOwnerResults = await this.batchProcess(
      safeOwnerAddresses,
      async (address) => {
        const raw = await transactionApi.getSafe(address);
        const safe = SafeSchema.parse(raw);
        return { address, owners: safe.owners, threshold: safe.threshold };
      },
    );

    const { deadlockDetected, unknownState, nestedCandidates } =
      this.checkMutualDependencies(safeOwnerResults, safeAddress, projected);

    if (deadlockDetected) {
      return this.buildResponse(DeadlockStatus.DEADLOCK_DETECTED);
    }

    if (
      nestedCandidates.length > 0 &&
      (await this.checkNestedSafes(transactionApi, nestedCandidates))
    ) {
      return this.buildResponse(DeadlockStatus.NESTED_SAFE_WARNING);
    }

    if (unknownState) {
      return this.buildResponse(DeadlockStatus.DEADLOCK_UNKNOWN);
    }

    return this.buildResponse(DeadlockStatus.NO_DEADLOCK);
  }

  private async fetchProjectedState(
    transactionApi: ITransactionApi,
    safeAddress: Address,
    dataDecoded: BaseDataDecoded,
  ): Promise<{ owners: Array<Address>; threshold: number }> {
    const rawSafe = await transactionApi.getSafe(safeAddress);
    const currentSafe = SafeSchema.parse(rawSafe);
    return computeProjectedState({
      currentOwners: currentSafe.owners,
      currentThreshold: currentSafe.threshold,
      dataDecoded,
    });
  }

  private async identifySafeOwners(
    transactionApi: ITransactionApi,
    owners: Array<Address>,
  ): Promise<Array<Address>> {
    const results = await this.batchProcess(owners, async (owner) => ({
      address: owner,
      isSafe: await transactionApi.isSafe(owner),
    }));
    return results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<{ address: Address; isSafe: boolean }> =>
          r.status === 'fulfilled' && r.value.isSafe,
      )
      .map((r) => r.value.address);
  }

  private checkMutualDependencies(
    safeOwnerResults: Array<
      PromiseSettledResult<{
        address: Address;
        owners: Array<Address>;
        threshold: number;
      }>
    >,
    safeAddress: Address,
    projected: { owners: Array<Address>; threshold: number },
  ): {
    deadlockDetected: boolean;
    unknownState: boolean;
    nestedCandidates: Array<Address>;
  } {
    let unknownState = false;
    let deadlockDetected = false;
    const nestedCandidates: Array<Address> = [];

    for (const result of safeOwnerResults) {
      if (result.status === 'rejected') {
        unknownState = true;
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
          return { deadlockDetected, unknownState, nestedCandidates };
        }
      }

      for (const o of ownerSafe.owners) {
        if (!isAddressEqual(o, safeAddress)) {
          nestedCandidates.push(o);
        }
      }
    }

    return { deadlockDetected, unknownState, nestedCandidates };
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
