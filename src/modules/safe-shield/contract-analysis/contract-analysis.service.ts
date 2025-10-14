import {
  Contract,
  ContractPageSchema,
} from '@/domain/data-decoder/v2/entities/contract.entity';
import { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import {
  DESCRIPTION_MAPPING,
  SEVERITY_MAPPING,
  TITLE_MAPPING,
} from '@/modules/safe-shield/contract-analysis/contract-analysis.constants';
import { ContractAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';
import {
  AnalysisResult,
  ContractAnalysisResult,
} from '@/modules/safe-shield/entities/analysis-result.entity';
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

  //TODO if no pairs are found, return {}
  async analyze(args: {
    chainId: string;
    safeAddress: Address;
    transactions: Array<DecodedTransactionData>;
  }): Promise<ContractAnalysisResponse> {
    const contractPairs = extractContracts(
      args.transactions,
      this.erc20Decoder,
    );
    const cacheDir = CacheRouter.getContractAnalysisCacheDir({
      chainId: args.chainId,
      contractPairs,
    });

    const cached = await this.cacheService.hGet(cacheDir);
    if (cached) {
      logCacheHit(cacheDir, this.loggingService);
      try {
        return JSON.parse(cached) as ContractAnalysisResponse;
      } catch (error) {
        this.loggingService.warn(
          `Failed to parse cached contract analysis results for ${JSON.stringify(cacheDir)}: ${error}`,
        );
      }
    }
    logCacheMiss(cacheDir, this.loggingService);

    const analysisResults: ContractAnalysisResponse = {};
    for (const [contract, isDelegateCall] of contractPairs) {
      const result = await this.analyzeContract({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        contract,
        isDelegateCall,
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
    isDelegateCall: boolean;
  }): Promise<Record<ContractStatusGroup, Array<ContractAnalysisResult>>> {
    const { chainId, safeAddress, contract, isDelegateCall } = args;

    const [[verificationResult, delegateCallResult], interactionResult] =
      await Promise.all([
        this.verifyContract({ chainId, contract, isDelegateCall }),
        this.analyzeInteractions({ chainId, safeAddress, contract }),
      ]);

    return {
      CONTRACT_VERIFICATION: [verificationResult],
      CONTRACT_INTERACTION: [interactionResult],
      DELEGATECALL: delegateCallResult ? [delegateCallResult] : [],
    };
  }

  /**
   * Verify a contract. In case of delegateCall, check for trustworthiness.
   * @param args - The arguments for the analysis.
   * @param args.chainId - The chain ID.
   * @param args.contract - The contract address.
   * @param args.isDelegateCall - Whether the contract is called via delegateCall.
   * @returns A pair of analysis results: [verification result, delegateCall result (if available)].
   */
  async verifyContract(args: {
    chainId: string;
    contract: Address;
    isDelegateCall: boolean;
  }): Promise<
    [
      ContractAnalysisResult,
      AnalysisResult<'UNEXPECTED_DELEGATECALL'> | undefined,
    ]
  > {
    let type: ContractStatus;
    let name: string | undefined;
    let resolvedContract: Contract | undefined;

    const { chainId, contract, isDelegateCall } = args;

    try {
      const rawContracts = await this.dataDecoderApi.getContracts({
        address: contract,
        chainId,
      });
      const { count, results } = ContractPageSchema.parse(rawContracts);

      if (count) {
        resolvedContract = results[0];
        const { abi, displayName, name: rawName } = resolvedContract;

        type = abi ? 'VERIFIED' : 'NOT_VERIFIED';
        name = displayName || rawName;
      } else {
        type = 'NOT_VERIFIED_BY_SAFE';
      }
    } catch {
      type = 'VERIFICATION_UNAVAILABLE';
    }

    const delegateCallResult = this.checkDelegateCall(
      isDelegateCall,
      resolvedContract,
    );
    return [this.mapToAnalysisResult({ type, name }), delegateCallResult];
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
    const { chainId, safeAddress, contract } = args;
    const transactionApi = await this.transactionApiManager.getApi(chainId);

    const page = await transactionApi.getMultisigTransactions({
      safeAddress,
      to: contract,
      limit: 1,
    });

    const multisigPage = MultisigTransactionPageSchema.parse(page);
    const interactions = multisigPage.count ?? 0;
    const type = interactions > 0 ? 'KNOWN_CONTRACT' : 'NEW_CONTRACT';

    return this.mapToAnalysisResult({ type, interactions });
  }

  /**
   * Checks if a delegateCall is unexpected based on the contract's trust status.
   * @param isDelegateCall - Whether the call is a delegateCall.
   * @param contract - The contract details (if available).
   * @returns The analysis result (if available).
   */
  private checkDelegateCall(
    isDelegateCall: boolean,
    contract: Contract | undefined,
  ): AnalysisResult<'UNEXPECTED_DELEGATECALL'> | undefined {
    if (!isDelegateCall || contract?.trustedForDelegateCall) return undefined;
    return this.mapToAnalysisResult({ type: 'UNEXPECTED_DELEGATECALL' });
  }

  /**
   * Maps a contract verification status to an analysis result.
   * @param type - The contract status.
   * @param interactions - The number of interactions with the contract (if applicable).
   * @param name - The name of the contract (if applicable).
   * @returns The analysis result.
   */
  private mapToAnalysisResult<T extends ContractStatus>(args: {
    type: T;
    interactions?: number;
    name?: string;
  }): AnalysisResult<T> {
    const { type, interactions, name } = args;
    const severity = SEVERITY_MAPPING[type];
    const title = TITLE_MAPPING[type];
    const description = DESCRIPTION_MAPPING[type]({ interactions, name });

    return { severity, type, title, description };
  }
}
