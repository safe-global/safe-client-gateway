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
   * @param {Address} args.contract - The contract and its metadata to analyze.
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
   * Verifies a contract and performs security checks.
   *
   * Performs the following checks:
   * - Contract verification: Checks if the contract has a verified ABI in the Data Decoder
   * - Delegate call check: Warns if the contract is called via delegateCall and is not trusted
   * - Fallback handler check: Warns if setting an unofficial/untrusted fallback handler
   *
   * @param {string} args.chainId - The chain ID
   * @param {ExtractedContract} args.contract - The contract address and its metadata (address, isDelegateCall, fallbackHandler)
   * @returns {Promise<ContractVerificationResult>}
   * Grouped analysis results containing:`CONTRACT_VERIFICATION`, `DELEGATECALL`,`FALLBACK_HANDLER`
   */
  public async verifyContract(args: {
    chainId: string;
    contract: ExtractedContract;
  }): Promise<ContractVerificationResult> {
    const { chainId, contract } = args;
    const { address } = contract;

    let verificationResult: Partial<
      GroupedAnalysisResults<ContractAnalysisResult>
    > & { name?: string; logoUrl?: string } = {};
    let resolvedContract: Contract | undefined;

    try {
      const raw = await this.dataDecoderApi.getContracts({
        address,
        chainId,
      });
      const { count, results } = ContractPageSchema.parse(raw);

      if (count && results.length > 0) {
        resolvedContract = results[0];
        const name = this.extractContractName(resolvedContract);
        const verificationType = resolvedContract.abi
          ? 'VERIFIED'
          : 'NOT_VERIFIED';

        verificationResult = {
          CONTRACT_VERIFICATION: [
            this.mapToAnalysisResult({ type: verificationType, name }),
          ],
          name,
          logoUrl: resolvedContract.logoUrl,
        };
      }
    } catch {
      verificationResult = {
        CONTRACT_VERIFICATION: [
          this.mapToAnalysisResult({ type: 'VERIFICATION_UNAVAILABLE' }),
        ],
      };
    }

    return {
      ...verificationResult,
      ...this.buildSecurityChecks(chainId, contract, resolvedContract),
    };
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
   * Builds security check results for delegate calls and fallback handlers.
   * @param {string} chainId - The chain ID
   * @param {ExtractedContract} contract - The contract and its metadata
   * @param {Contract} resolvedContract - The resolved contract data (if available)
   * @returns {GroupedAnalysisResults<ContractAnalysisResult>} Security check results
   */
  private buildSecurityChecks(
    chainId: string,
    contract: ExtractedContract,
    resolvedContract?: Contract,
  ): GroupedAnalysisResults<ContractAnalysisResult> {
    const { isDelegateCall, fallbackHandler } = contract;
    return {
      ...this.withDelegate(isDelegateCall, resolvedContract),
      ...this.withFallbackHandler(chainId, fallbackHandler),
    };
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
   * Helper to include delegatecall result if applicable.
   */
  private withDelegate(
    isDelegateCall: boolean,
    resolved?: Contract,
  ): GroupedAnalysisResults<ContractAnalysisResult> {
    const res = this.checkDelegateCall(isDelegateCall, resolved);
    return res ? { DELEGATECALL: [res] } : {};
  }

  /**
   * Helper to include fallback handler result if applicable.
   */
  private withFallbackHandler(
    chainId: string,
    fallbackHandler: Address | undefined,
  ): GroupedAnalysisResults<ContractAnalysisResult> & {
    fallbackHandler?: Address | undefined;
  } {
    const res = this.checkUntrustedFallbackHandler(chainId, fallbackHandler);
    return res ? { FALLBACK_HANDLER: [res], fallbackHandler } : {};
  }

  /**
   * Checks if a delegateCall is unexpected based on the contract's trust status.
   * @param {boolean} isDelegateCall - Whether the call is a delegateCall.
   * @param {Contract | undefined} contract - The contract details (if available).
   * @returns {AnalysisResult<'UNEXPECTED_DELEGATECALL'> | undefined} The analysis result (if available).
   */
  private checkDelegateCall(
    isDelegateCall: boolean,
    contract: Contract | undefined,
  ): AnalysisResult<'UNEXPECTED_DELEGATECALL'> | undefined {
    if (!isDelegateCall || contract?.trustedForDelegateCall) return undefined;
    return this.mapToAnalysisResult({ type: 'UNEXPECTED_DELEGATECALL' });
  }

  /**
   * Checks if a fallback handler is untrusted (not an official Safe or TWAP handler).
   *
   * @param {string} chainId - The chain ID
   * @param {Address | undefined} fallbackHandlerAddress - The fallback handler address to check
   * @returns {AnalysisResult<'UNOFFICIAL_FALLBACK_HANDLER'> | undefined} Analysis result if untrusted, undefined otherwise
   */
  private checkUntrustedFallbackHandler(
    chainId: string,
    fallbackHandlerAddress: Address | undefined,
  ): AnalysisResult<'UNOFFICIAL_FALLBACK_HANDLER'> | undefined {
    if (!fallbackHandlerAddress) {
      return undefined;
    }

    // Check if it's the TWAP fallback handler (CowSwap)
    const twapFallbackHandler = tWAPFallbackHandlerAddress(chainId);
    const isTrustedTWAPHandler =
      !!twapFallbackHandler &&
      fallbackHandlerAddress.toLowerCase() ===
        twapFallbackHandler.toLowerCase();

    // Check if it's an official Safe fallback handler
    const isOfficialSafeHandler = this.isOfficialFallbackHandler(
      fallbackHandlerAddress,
      chainId,
    );

    return isTrustedTWAPHandler || isOfficialSafeHandler
      ? undefined
      : this.mapToAnalysisResult({ type: 'UNOFFICIAL_FALLBACK_HANDLER' });
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
