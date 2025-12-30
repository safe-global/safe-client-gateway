import {
  Contract,
  ContractPageSchema,
} from '@/modules/data-decoder/domain/v2/entities/contract.entity';
import { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import {
  DESCRIPTION_MAPPING,
  SEVERITY_MAPPING,
  TITLE_MAPPING,
  tWAPFallbackHandlerAddress,
} from '@/modules/safe-shield/contract-analysis/contract-analysis.constants';
import {
  type ContractAnalysisResponse,
  ContractVerificationResult,
  GroupedAnalysisResults,
} from '@/modules/safe-shield/entities/analysis-responses.entity';
import {
  AnalysisResult,
  CommonStatus,
  ContractAnalysisResult,
  UnofficialFallbackHandlerAnalysisResult,
} from '@/modules/safe-shield/entities/analysis-result.entity';
import { ContractStatus } from '@/modules/safe-shield/entities/contract-status.entity';
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
import type { ExtractedContract } from '@/modules/safe-shield/entities/extracted-contract.entity';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { MultisigTransactionPageSchema } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import {
  isFallbackHandlerDeployed,
  getFallbackHandlerVersions,
} from '@/domain/common/utils/deployments';

/**
 * Result type for contract metadata fetch operations.
 * Uses discriminated union to distinguish between success and error states.
 */
type ContractFetchResult = { ok: true; contract?: Contract } | { ok: false };

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

  /**
   * Analyzes contracts.
   * Extracts contract addresses, checks cache, and performs analysis on each contract.
   *
   * @param {string} args.chainId - The chain ID.
   * @param {Address} args.safeAddress - The Safe wallet address.
   * @param {Array<DecodedTransactionData>} args.transactions - The transactions to analyze.
   * @returns {Promise<ContractAnalysisResponse>} A map of contract addresses to their analysis results.
   */
  public async analyze(args: {
    chainId: string;
    safeAddress: Address;
    transactions: Array<DecodedTransactionData>;
  }): Promise<ContractAnalysisResponse> {
    const contracts = extractContracts(args.transactions, this.erc20Decoder);
    if (!contracts.length) {
      return {};
    }
    const cacheDir = CacheRouter.getContractAnalysisCacheDir({
      chainId: args.chainId,
      contracts,
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

    const analysisResults: ContractAnalysisResponse = Object.fromEntries(
      await Promise.all(
        contracts.map(async (contract) => [
          contract.address,
          await this.analyzeContract({
            chainId: args.chainId,
            safeAddress: args.safeAddress,
            contract,
          }),
        ]),
      ),
    );

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(analysisResults),
      this.defaultExpirationTimeInSeconds,
    );
    return analysisResults;
  }

  /**
   * Analyzes a single contract by performing verification and interaction checks.
   * Groups results by analysis type: verification, interaction, and delegatecall checks.
   *
   * @param {string} args.chainId - The chain ID.
   * @param {Address} args.safeAddress - The Safe wallet address.
   * @param {ExtractedContract} args.contract - The contract and its metadata to analyze.
   * @returns {Promise<GroupedAnalysisResults<ContractAnalysisResult>>} Grouped analysis results by category.
   */
  public async analyzeContract(args: {
    chainId: string;
    safeAddress: Address;
    contract: ExtractedContract;
  }): Promise<GroupedAnalysisResults<ContractAnalysisResult>> {
    const { chainId, safeAddress, contract } = args;

    const [verificationResult, interactionResult] = await Promise.all([
      this.verifyContract({ chainId, contract }),
      this.analyzeInteractions({
        chainId,
        safeAddress,
        address: contract.address,
      }),
    ]);

    return {
      ...verificationResult,
      ...interactionResult,
    };
  }

  /**
   * Analyzes a contract's security by performing verification and security checks.
   *
   * Performs the following checks:
   * - Contract verification: Checks if the contract has a verified ABI in the Data Decoder
   * - Delegate call check: Warns if the contract is called via delegateCall and is not trusted
   * - Fallback handler check: Warns if setting an unofficial/untrusted fallback handler
   *
   * @param {string} args.chainId - The chain ID
   * @param {ExtractedContract} args.contract - The contract address and its metadata (address, isDelegateCall, fallbackHandler)
   * @returns {Promise<ContractVerificationResult>}
   * Grouped analysis results containing: `CONTRACT_VERIFICATION`, `DELEGATECALL`, `FALLBACK_HANDLER`
   */
  public async verifyContract(args: {
    chainId: string;
    contract: ExtractedContract;
  }): Promise<ContractVerificationResult> {
    const { chainId, contract } = args;

    // Fetch contract metadata and fallback handler check concurrently
    // These are independent network calls that can run in parallel
    const [fetchResult, fallbackHandlerCheck] = await Promise.all([
      this.fetchContractMetadata(chainId, contract.address),
      this.performFallbackHandlerCheck(chainId, contract.fallbackHandler),
    ]);

    const verificationCheck = this.performVerificationCheck(fetchResult);

    const resolvedContract = fetchResult.ok ? fetchResult.contract : undefined;
    const delegateCallCheck = this.performDelegateCallCheck(
      contract.isDelegateCall,
      resolvedContract,
    );

    return {
      ...verificationCheck,
      ...delegateCallCheck,
      ...fallbackHandlerCheck,
      name: resolvedContract && this.extractContractName(resolvedContract),
      logoUrl: resolvedContract?.logoUrl,
    };
  }

  /**
   * Performs contract verification check.
   * Determines if the contract has a verified ABI.
   *
   * @param {ContractFetchResult} fetchResult - The result of fetching contract metadata
   * @returns {GroupedAnalysisResults<ContractAnalysisResult> & {name?: string; logoUrl?: string;}} Verification check results
   */
  private performVerificationCheck(
    fetchResult: ContractFetchResult,
  ): GroupedAnalysisResults<ContractAnalysisResult> & {
    name?: string;
    logoUrl?: string;
  } {
    if (!fetchResult.ok) {
      return {
        CONTRACT_VERIFICATION: [
          this.mapToAnalysisResult({ type: 'VERIFICATION_UNAVAILABLE' }),
        ],
      };
    }

    const contract = fetchResult.contract;
    if (!contract) return {};

    const name = this.extractContractName(contract);

    return {
      CONTRACT_VERIFICATION: [
        this.mapToAnalysisResult({
          type: contract.abi ? 'VERIFIED' : 'NOT_VERIFIED',
          name,
        }),
      ],
      name,
      logoUrl: contract.logoUrl,
    };
  }

  /**
   * Performs delegatecall security check.
   * Warns if the contract is called via delegateCall and is not trusted.
   *
   * @param {boolean} isDelegateCall - Whether the call is a delegateCall
   * @param {Contract | undefined} resolvedContract - The resolved contract metadata
   * @returns {GroupedAnalysisResults<ContractAnalysisResult>} Delegatecall check results
   */
  private performDelegateCallCheck(
    isDelegateCall: boolean,
    resolvedContract: Contract | undefined,
  ): GroupedAnalysisResults<ContractAnalysisResult> {
    if (!isDelegateCall || resolvedContract?.trustedForDelegateCall) {
      return {};
    }

    return {
      DELEGATECALL: [
        this.mapToAnalysisResult({ type: 'UNEXPECTED_DELEGATECALL' }),
      ],
    };
  }

  /**
   * Performs fallback handler security check.
   * Warns if setting an unofficial/untrusted fallback handler.
   *
   * @param {string} chainId - The chain ID
   * @param {Address | undefined} fallbackHandlerAddress - The fallback handler address
   * @returns {Promise<GroupedAnalysisResults<ContractAnalysisResult>>} Fallback handler check results
   */
  private async performFallbackHandlerCheck(
    chainId: string,
    fallbackHandlerAddress: Address | undefined,
  ): Promise<GroupedAnalysisResults<ContractAnalysisResult>> {
    const result = await this.checkUntrustedFallbackHandler(
      chainId,
      fallbackHandlerAddress,
    );
    return result ? { FALLBACK_HANDLER: [result] } : {};
  }

  /**
   * Fetches contract metadata from the data decoder API.
   * Returns a discriminated union to distinguish between success and error cases.
   *
   * @param {string} chainId - The chain ID
   * @param {Address} address - The contract address
   * @returns {Promise<ContractFetchResult>}
   *   - { ok: true, contract?: Contract }: Successful API call (contract may be undefined if not found)
   *   - { ok: false }: API call failed
   */
  private async fetchContractMetadata(
    chainId: string,
    address: Address,
  ): Promise<ContractFetchResult> {
    try {
      const raw = await this.dataDecoderApi.getContracts({ address, chainId });
      const { results } = ContractPageSchema.parse(raw);

      return {
        ok: true,
        contract: results[0],
      };
    } catch (error) {
      this.loggingService.warn(
        `Failed to fetch contract metadata for ${address} on chain ${chainId}: ${error}`,
      );

      return { ok: false };
    }
  }

  /**
   * Extracts the contract name, preferring displayName over name.
   * @param {Contract} contract - The contract data
   * @returns {string | undefined} The contract name or undefined
   */
  private extractContractName(contract: Contract): string | undefined {
    return contract.displayName || contract.name || undefined;
  }

  /**
   * Analyzes the interactions between a Safe and a contract.
   *
   * @param {string} args.chainId - The chain ID.
   * @param {Address} args.safeAddress - The Safe address.
   * @param {Address} args.contract - The contract address.
   * @returns {Promise<GroupedAnalysisResults<ContractAnalysisResult>>} Partial analysis result group: interactions result.
   */
  public async analyzeInteractions(args: {
    chainId: string;
    safeAddress: Address;
    address: Address;
  }): Promise<GroupedAnalysisResults<ContractAnalysisResult>> {
    const { chainId, safeAddress, address } = args;
    try {
      const transactionApi = await this.transactionApiManager.getApi(chainId);

      const page = await transactionApi.getMultisigTransactions({
        safeAddress,
        to: address,
        executed: true,
        limit: 1,
      });

      const interactions = MultisigTransactionPageSchema.parse(page).count ?? 0;
      if (interactions === 0) return {};

      return {
        CONTRACT_INTERACTION: [
          this.mapToAnalysisResult({ type: 'KNOWN_CONTRACT' }),
        ],
      };
    } catch (error) {
      this.loggingService.warn(
        `Failed to analyze contract interactions: ${error}`,
      );
      return {
        CONTRACT_INTERACTION: [
          this.mapToAnalysisResult({
            type: 'FAILED',
            error: 'contract interactions unavailable',
          }),
        ],
      };
    }
  }

  /**
   * Checks if a fallback handler is untrusted (not an official Safe or TWAP handler).
   * Fetches metadata (name, logoUrl) for unofficial fallback handlers.
   *
   * @param {string} chainId - The chain ID
   * @param {Address | undefined} fallbackHandlerAddress - The fallback handler address to check
   * @returns {Promise<UnofficialFallbackHandlerAnalysisResult | undefined>} Analysis result with metadata if untrusted, undefined otherwise
   */
  private async checkUntrustedFallbackHandler(
    chainId: string,
    fallbackHandlerAddress: Address | undefined,
  ): Promise<UnofficialFallbackHandlerAnalysisResult | undefined> {
    if (!fallbackHandlerAddress) {
      return;
    }

    const twapFallbackHandler = tWAPFallbackHandlerAddress(chainId);
    const isTrustedTWAPHandler =
      !!twapFallbackHandler &&
      fallbackHandlerAddress.toLowerCase() ===
        twapFallbackHandler.toLowerCase();

    const isOfficialSafeHandler = this.isOfficialFallbackHandler(
      fallbackHandlerAddress,
      chainId,
    );

    if (isTrustedTWAPHandler || isOfficialSafeHandler) {
      return;
    }

    const fetchResult = await this.fetchContractMetadata(
      chainId,
      fallbackHandlerAddress,
    );
    const contract = fetchResult.ok ? fetchResult.contract : undefined;

    return {
      ...this.mapToAnalysisResult({ type: 'UNOFFICIAL_FALLBACK_HANDLER' }),
      fallbackHandler: {
        address: fallbackHandlerAddress,
        name: contract && this.extractContractName(contract),
        logoUrl: contract?.logoUrl,
      },
    };
  }

  /**
   * Checks if a fallback handler address matches any official Safe fallback handler deployment
   * across all available versions (>= 1.3.0).
   *
   * @param {Address} address - The fallback handler address to check
   * @param {string} chainId - The chain ID to check deployments on
   * @returns {boolean} True if the address matches an official Safe fallback handler deployment
   */
  private isOfficialFallbackHandler(
    address: Address,
    chainId: string,
  ): boolean {
    return getFallbackHandlerVersions().some((version) =>
      isFallbackHandlerDeployed({ chainId, version, address }),
    );
  }

  /**
   * Maps a contract verification status to an analysis result.
   * @template T - The contract status type.
   * @param {T} args.type - The contract status.
   * @param {string} args.name - The name of the contract (if applicable).
   * @param {string} args.error - The error message (if applicable).
   * @returns {AnalysisResult<T>} The contract analysis result.
   */
  private mapToAnalysisResult<T extends ContractStatus | CommonStatus>(args: {
    type: T;
    name?: string;
    error?: string;
  }): AnalysisResult<T> {
    const { type, name, error } = args;
    const severity = SEVERITY_MAPPING[type];
    const title = TITLE_MAPPING[type];
    const description = DESCRIPTION_MAPPING[type]({
      name,
      error,
    });

    return { severity, type, title, description };
  }
}
