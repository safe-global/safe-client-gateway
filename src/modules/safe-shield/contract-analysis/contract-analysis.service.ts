import { ContractPageSchema } from '@/domain/data-decoder/v2/entities/contract.entity';
import { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import {
  DESCRIPTION_MAPPING,
  SEVERITY_MAPPING,
  TITLE_MAPPING,
} from '@/modules/safe-shield/contract-analysis/contract-analysis.constants';
import { ContractAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';
import { ContractAnalysisResult } from '@/modules/safe-shield/entities/analysis-result.entity';
import { ContractStatus } from '@/modules/safe-shield/entities/contract-status.entity';
import { ContractStatusGroup } from '@/modules/safe-shield/entities/status-group.entity';
import { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';
import { uniq } from 'lodash';
import { Address } from 'viem';
import { logCacheHit, logCacheMiss } from '@/modules/safe-shield/utils/common';
import { extractContract } from '@/modules/safe-shield/utils/extraction.utils';

/**
 * Service responsible for analyzing contract interactions in transactions.
 */
@Injectable()
export class ContractAnalysisService {
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject(IDataDecoderApi)
    private readonly dataDecoderApi: IDataDecoderApi,
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
    transactions: Array<DecodedTransactionData>;
  }): Promise<ContractAnalysisResponse> {
    const contracts = this.extractContracts(args.transactions);
    const cacheDir = CacheRouter.getContractAnalysisCacheDir({
      chainId: args.chainId,
      contracts,
    });

    const cached = await this.cacheService.hGet(cacheDir);
    if (cached) {
      logCacheHit(cacheDir, this.loggingService);
      return JSON.parse(cached) as ContractAnalysisResponse;
    }
    logCacheMiss(cacheDir, this.loggingService);

    const analysisResults: ContractAnalysisResponse = {};
    for (const contract of contracts) {
      const result = await this.analyzeContract({
        chainId: args.chainId,
        contract,
      });

      analysisResults[contract] = result;
    }

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(analysisResults),
      this.defaultExpirationTimeInSeconds,
    );
    return analysisResults;
  }

  async analyzeContract(args: {
    chainId: string;
    contract: Address;
  }): Promise<Record<ContractStatusGroup, Array<ContractAnalysisResult>>> {
    const contractVerificationResult = await this.verifyContract(args);
    return {
      CONTRACT_VERIFICATION: [contractVerificationResult],
      CONTRACT_INTERACTION: [],
      DELEGATECALL: [],
    };
  }

  async verifyContract(args: {
    chainId: string;
    contract: Address;
  }): Promise<ContractAnalysisResult> {
    let type: ContractStatus;
    try {
      const contracts = await this.dataDecoderApi.getContracts({
        address: args.contract,
        chainId: args.chainId,
      });
      const { count, results } = ContractPageSchema.parse(contracts);
      if (count) {
        type = results[0].abi ? 'VERIFIED' : 'NOT_VERIFIED';
      } else {
        type = 'NOT_VERIFIED_BY_SAFE';
      }
    } catch {
      type = 'VERIFICATION_UNAVAILABLE';
    }
    return this.mapToAnalysisResult(type);
  }

  /**
   * Maps a contract verification status to an analysis result.
   * @param type - The contract status.
   * @param interactions - The number of interactions with the contract (if applicable).
   * @returns The analysis result.
   */
  private mapToAnalysisResult(
    type: ContractStatus,
    interactions?: number,
  ): ContractAnalysisResult {
    const severity = SEVERITY_MAPPING[type];
    const title = TITLE_MAPPING[type];
    const description = DESCRIPTION_MAPPING[type](interactions ?? 0);

    return { severity, type, title, description };
  }

  /**
   * Extracts the unique contract addresses from transactions.
   * @param transactions - The transactions.
   * @returns The unique contract addresses.
   */
  private extractContracts(
    transactions: Array<DecodedTransactionData>,
  ): Array<Address> {
    return uniq(
      transactions
        .map((tx) => extractContract(tx))
        .filter((contract) => !!contract),
    );
  }
}
