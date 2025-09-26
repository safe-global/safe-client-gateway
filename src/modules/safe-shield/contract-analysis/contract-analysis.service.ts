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
import { Address } from 'viem';
import { logCacheHit, logCacheMiss } from '@/modules/safe-shield/utils/common';
import { extractContracts } from '@/modules/safe-shield/utils/extraction.utils';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { MultisigTransactionPageSchema } from '@/domain/safe/entities/multisig-transaction.entity';

/**
 * Service responsible for analyzing contract interactions in transactions.
 */
@Injectable()
export class ContractAnalysisService {
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject(IDataDecoderApi)
    private readonly dataDecoderApi: IDataDecoderApi,
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly erc20Decoder: Erc20Decoder,
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
  }): Promise<ContractAnalysisResponse> {
    const contracts = extractContracts(args.transactions, this.erc20Decoder);
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
        safeAddress: args.safeAddress,
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
    safeAddress: Address;
    contract: Address;
  }): Promise<Record<ContractStatusGroup, Array<ContractAnalysisResult>>> {
    const [contractVerificationResult, contractInteractionResult] =
      await Promise.all([
        this.verifyContract({
          chainId: args.chainId,
          contract: args.contract,
        }),
        this.analyzeInteractions(args),
      ]);

    return {
      CONTRACT_VERIFICATION: [contractVerificationResult],
      CONTRACT_INTERACTION: [contractInteractionResult],
      DELEGATECALL: [],
    };
  }

  /**
   * Verify a contract.
   * @param args - The arguments for the analysis.
   * @param args.chainId - The chain ID.
   * @param args.contract - The contract address.
   * @returns The analysis result.
   */
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
        //TODO check what to do if abiJson is null
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
   * Analyzes the interactions between a Safe and a contract.
   * @param args - The arguments for the analysis.
   * @param args.chainId - The chain ID.
   * @param args.safeAddress - The Safe address.
   * @param args.contract - The contract address.
   * @returns The analysis result.
   */
  async analyzeInteractions(args: {
    chainId: string;
    safeAddress: Address;
    contract: Address;
  }): Promise<ContractAnalysisResult> {
    const transactionApi = await this.transactionApiManager.getApi(
      args.chainId,
    );

    const page = await transactionApi.getMultisigTransactions({
      safeAddress: args.safeAddress,
      to: args.contract,
      limit: 1,
    });

    const multisigPage = MultisigTransactionPageSchema.parse(page);
    const interactions = multisigPage.count ?? 0;
    const type = interactions > 0 ? 'KNOWN_CONTRACT' : 'NEW_CONTRACT';

    return this.mapToAnalysisResult(type, interactions);
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
}
