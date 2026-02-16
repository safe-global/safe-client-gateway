import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { TransferPageSchema } from '@/modules/safe/domain/entities/transfer.entity';
import {
  type AnalysisResult,
  CommonStatus,
} from '@/modules/safe-shield/entities/analysis-result.entity';
import { Inject, Injectable } from '@nestjs/common';
import { getAddress, type Hex, zeroAddress, type Address } from 'viem';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { SafeSchema } from '@/modules/safe/domain/entities/schemas/safe.schema';
import {
  SEVERITY_MAPPING,
  TITLE_MAPPING,
  DESCRIPTION_MAPPING,
} from './recipient-analysis.constants';
import { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import { BridgeStatus } from '@/modules/safe-shield/entities/bridge-status.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import {
  type RecipientAnalysisResponse,
  type RecipientAnalysisResponseWithoutIsSafe,
  type SingleRecipientAnalysisResponse,
} from '@/modules/safe-shield/entities/analysis-responses.entity';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { extractRecipients } from '../utils/extraction.utils';
import { logCacheHit, logCacheMiss } from '@/modules/safe-shield/utils/common';
import { TransactionInfo } from '@/modules/transactions/routes/entities/transaction-info.entity';
import {
  BridgeAndSwapTransactionInfo,
  isBridgeAndSwapTransactionInfo,
  isSwapTransactionInfo,
} from '@/modules/transactions/routes/entities/bridge/bridge-info.entity';
import { type Safe } from '@/modules/safe/domain/entities/safe.entity';
import { TransactionsService } from '@/modules/transactions/routes/transactions.service';
import {
  hasCanonicalDeploymentSafeToL2Migration,
  hasCanonicalDeploymentSafeToL2Setup,
  isFallbackHandlerDeployed,
  isL1SingletonDeployed,
  isL2SingletonDeployed,
  isProxyFactoryDeployed,
} from '@/domain/common/utils/deployments';
import { Chain } from '@/modules/chains/routes/entities/chain.entity';
import { merge } from 'lodash';
import type { SafeCreationData } from '@/modules/safe-shield/entities/safe-creation-data.entity';
import { type ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { isSwapOrderTransactionInfo } from '@/modules/transactions/routes/entities/swaps/swap-order-info.entity';
import { RecipientStatusGroup } from '@/modules/safe-shield/entities/status-group.entity';

const SAFE_VERSIONS = ['1.4.1', '1.3.0', '1.2.0', '1.1.1', '1.0.0'] as const;
type SafeVersion = (typeof SAFE_VERSIONS)[number];

/**
 * Service responsible for analyzing transaction recipients and bridge configurations.
 */
@Injectable()
export class RecipientAnalysisService {
  private readonly defaultExpirationTimeInSeconds: number;

  private static readonly MULTICHAIN_SUPPORTED_VERSIONS = [
    '1.4.1',
    '1.3.0',
  ] as const;
  private static readonly LOW_ACTIVITY_THRESHOLD = 5;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly erc20Decoder: Erc20Decoder,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    private readonly transactionsService: TransactionsService,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  /**
   * Analyzes the recipients and bridge compatibility for a Safe.
   * @param {string} args.chainId - The chain ID.
   * @param {Address} args.safeAddress - The Safe address.
   * @param {Array<DecodedTransactionData>} args.transactions - The transactions to analyze.
   * @param {TransactionInfo} [args.txInfo] - The transaction info.
   * @returns {Promise<RecipientAnalysisResponse>} The analysis results.
   */
  public async analyze(args: {
    chainId: string;
    safeAddress: Address;
    transactions: Array<DecodedTransactionData>;
    txInfo?: TransactionInfo;
  }): Promise<RecipientAnalysisResponse> {
    const { chainId, safeAddress, transactions, txInfo } = args;
    const recipients = extractRecipients(transactions, this.erc20Decoder);

    const cacheDir = CacheRouter.getRecipientAnalysisCacheDir({
      chainId,
      safeAddress,
      recipients,
      txInfo,
    });

    const cached = await this.cacheService.hGet(cacheDir);
    if (cached) {
      logCacheHit(cacheDir, this.loggingService);
      try {
        return JSON.parse(cached) as RecipientAnalysisResponse;
      } catch (error) {
        this.loggingService.warn(
          `Failed to parse cached recipient analysis results for ${JSON.stringify(cacheDir)}: ${error}`,
        );
      }
    }
    logCacheMiss(cacheDir, this.loggingService);

    const [recipientAnalysisResults, bridgeAnalysisResults] = await Promise.all(
      [
        this.analyzeRecipients({
          chainId,
          safeAddress,
          recipients,
        }),
        this.analyzeBridgeAndSwap({
          chainId,
          safeAddress,
          txInfo,
        }),
      ],
    );

    const analysisResults = merge(
      recipientAnalysisResults,
      bridgeAnalysisResults,
    );

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(analysisResults),
      this.defaultExpirationTimeInSeconds,
    );

    return analysisResults;
  }

  /**
   * Analyzes the recipients for a Safe.
   * @param {string} args.chainId - The chain ID.
   * @param {Address} args.safeAddress - The Safe address.
   * @param {Array<Address>} args.recipients - The recipient addresses to analyze.
   * @returns {Promise<RecipientAnalysisResponse>} The recipient analysis response.
   */
  private async analyzeRecipients(args: {
    chainId: string;
    safeAddress: Address;
    recipients: Array<Address>;
  }): Promise<RecipientAnalysisResponse> {
    const { chainId, safeAddress, recipients } = args;
    return Object.fromEntries(
      await Promise.all(
        recipients.map(async (recipient) => [
          recipient,
          await this.analyzeRecipient(chainId, safeAddress, recipient),
        ]),
      ),
    );
  }

  public async analyzeRecipient(
    chainId: string,
    safeAddress: Address,
    recipient: Address,
  ): Promise<SingleRecipientAnalysisResponse> {
    const failed = this.mapToAnalysisResult({ type: CommonStatus.FAILED });

    let transactionApi: ITransactionApi;
    try {
      transactionApi = await this.transactionApiManager.getApi(chainId);
    } catch (error) {
      this.loggingService.warn(
        `Failed to get transaction API for chain ${chainId}: ${error}`,
      );
      return {
        [RecipientStatusGroup.RECIPIENT_INTERACTION]: [failed],
        [RecipientStatusGroup.RECIPIENT_ACTIVITY]: [failed],
        isSafe: false,
      };
    }

    const [interactionResult, [activityResult, isSafe]] = await Promise.all([
      this.analyzeInteractions({
        transactionApi,
        safeAddress,
        recipient,
      }),
      this.analyzeActivity({ transactionApi, recipient }),
    ]);

    const recipientActivity = activityResult
      ? { [RecipientStatusGroup.RECIPIENT_ACTIVITY]: [activityResult] }
      : {};

    return {
      [RecipientStatusGroup.RECIPIENT_INTERACTION]: [interactionResult],
      ...recipientActivity,
      isSafe,
    };
  }

  /**
   * Analyzes the interactions between a Safe and a recipient.
   * @param {ITransactionApi} args.transactionApi - The transaction API instance.
   * @param {Address} args.safeAddress - The Safe address.
   * @param {Address} args.recipient - The recipient address.
   * @returns {Promise<AnalysisResult<RecipientStatus | CommonStatus>>} The analysis result indicating if recipient is new or recurring.
   */
  public async analyzeInteractions(args: {
    transactionApi: ITransactionApi;
    safeAddress: Address;
    recipient: Address;
  }): Promise<AnalysisResult<RecipientStatus | CommonStatus>> {
    try {
      const page = await args.transactionApi.getTransfers({
        safeAddress: args.safeAddress,
        to: args.recipient,
        limit: 1,
      });

      const transferPage = TransferPageSchema.parse(page);
      const interactions = transferPage.count ?? 0;
      const type =
        interactions > 0
          ? RecipientStatus.RECURRING_RECIPIENT
          : RecipientStatus.NEW_RECIPIENT;

      return this.mapToAnalysisResult({ type, interactions });
    } catch (error) {
      this.loggingService.warn(
        `Failed to analyze recipient interactions: ${error}`,
      );
      return this.mapToAnalysisResult({
        type: CommonStatus.FAILED,
        error: 'recipient interactions unavailable',
      });
    }
  }

  /**
   * Analyzes the activity level of a recipient address.
   * @param {ITransactionApi} args.transactionApi - The transaction API instance.
   * @param {Address} args.recipient - The recipient address.
   * @returns {Promise<[AnalysisResult<RecipientStatus | CommonStatus> | undefined, boolean]>}
   * A pair of the analysis result if low activity is detected, undefined otherwise and a boolean flag isSafe.
   */
  public async analyzeActivity(args: {
    transactionApi: ITransactionApi;
    recipient: Address;
  }): Promise<
    [AnalysisResult<RecipientStatus | CommonStatus> | undefined, boolean]
  > {
    const { transactionApi, recipient } = args;
    let isSafe: boolean = false;
    try {
      const response = await transactionApi.getSafe(recipient);
      const { nonce } = SafeSchema.parse(response);
      isSafe = true;

      return [
        nonce < RecipientAnalysisService.LOW_ACTIVITY_THRESHOLD
          ? this.mapToAnalysisResult({ type: RecipientStatus.LOW_ACTIVITY })
          : undefined,
        isSafe,
      ];
    } catch (error) {
      // Not found = it is not a Safe
      if (error instanceof DataSourceError && error.code === 404) {
        return [undefined, isSafe];
      } else {
        this.loggingService.warn(
          `Failed to analyze recipient activity: ${error}`,
        );
        return [
          this.mapToAnalysisResult({
            type: CommonStatus.FAILED,
            error: 'recipient activity check unavailable',
          }),
          isSafe,
        ];
      }
    }
  }

  private async analyzeBridgeAndSwap(args: {
    chainId: string;
    safeAddress: Address;
    txInfo?: TransactionInfo;
  }): Promise<
    RecipientAnalysisResponse | RecipientAnalysisResponseWithoutIsSafe
  > {
    const { chainId, safeAddress, txInfo } = args;
    if (!txInfo) {
      return {};
    }

    if (isBridgeAndSwapTransactionInfo(txInfo)) {
      return this.analyzeBridge({ chainId, safeAddress, txInfo });
    }

    const recipient = this.extractSwapRecipient(txInfo, safeAddress);
    if (recipient) {
      return this.analyzeRecipients({
        chainId,
        safeAddress,
        recipients: [recipient],
      });
    }

    return {};
  }

  /**
   * Extracts the recipient address from swap-related transactions if different from Safe address.
   * @param {TransactionInfo} txInfo - The transaction info.
   * @param {Address} safeAddress - The Safe address to compare against.
   * @returns {Address | null} The recipient address if different from Safe, null otherwise.
   */
  private extractSwapRecipient(
    txInfo: TransactionInfo,
    safeAddress: Address,
  ): Address | null {
    if (isSwapTransactionInfo(txInfo)) {
      const recipient = getAddress(txInfo.recipient.value);
      return recipient !== safeAddress ? recipient : null;
    }

    if (isSwapOrderTransactionInfo(txInfo)) {
      const receiver = txInfo.receiver ? getAddress(txInfo.receiver) : null;
      return receiver && receiver !== safeAddress ? receiver : null;
    }

    return null;
  }

  /**
   * Analyzes bridge compatibility for cross-chain operations.
   * @param {string} args.chainId - The chain ID.
   * @param {Address} args.safeAddress - The Safe address.
   * @param {BridgeAndSwapTransactionInfo} [args.txInfo] - The bridge transaction info.
   * @returns {Promise<RecipientAnalysisResponse | RecipientAnalysisResponseWithoutIsSafe>} The bridge analysis response (may or may not include isSafe).
   */
  public async analyzeBridge(args: {
    chainId: string;
    safeAddress: Address;
    txInfo: BridgeAndSwapTransactionInfo;
  }): Promise<
    RecipientAnalysisResponse | RecipientAnalysisResponseWithoutIsSafe
  > {
    const bridgeRecipient = getAddress(args.txInfo.recipient.value);

    if (bridgeRecipient === getAddress(args.safeAddress)) {
      const result = await this.analyzeTargetChainCompatibility({
        ...args,
        txInfo: args.txInfo,
      });

      if (!result) {
        return {};
      }

      const [resultStatus, targetChainId] = result;

      return {
        [bridgeRecipient]: {
          [RecipientStatusGroup.BRIDGE]: [
            this.mapToAnalysisResult({
              type: resultStatus,
              error:
                resultStatus === CommonStatus.FAILED
                  ? 'bridge compatibility unavailable'
                  : undefined,
              targetChainId,
            }),
          ],
        },
      };
    }

    // If the bridge recipient is not the same as the Safe address, we need to analyse the recipient
    return this.analyzeRecipients({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      recipients: [bridgeRecipient],
    });
  }

  /**
   * Analyzes compatibility between source and target chain Safes.
   * @param {string} args.chainId - The source chain ID.
   * @param {Address} args.safeAddress - The Safe address.
   * @param {BridgeAndSwapTransactionInfo} args.txInfo - The bridge transaction info.
   * @returns {Promise<[BridgeStatus | CommonStatus, string] | undefined>} A tuple of status and target chain ID if incompatible, undefined if compatible.
   */
  private async analyzeTargetChainCompatibility(args: {
    chainId: string;
    safeAddress: Address;
    txInfo: BridgeAndSwapTransactionInfo;
  }): Promise<[BridgeStatus | CommonStatus, string] | undefined> {
    if (
      getAddress(args.txInfo.recipient.value) !== getAddress(args.safeAddress)
    ) {
      return undefined;
    }
    const targetChainId = args.txInfo.toChain;

    try {
      const isTargetChainSupported =
        await this.chainsRepository.isSupportedChain(targetChainId);
      if (!isTargetChainSupported) {
        return [BridgeStatus.UNSUPPORTED_NETWORK, targetChainId];
      }

      const [sourceSafe, targetSafe] = await Promise.all([
        this.getSafe({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
        }),
        this.getSafe({
          chainId: targetChainId,
          safeAddress: args.safeAddress,
        }),
      ]);

      if (!sourceSafe) {
        this.loggingService.warn(
          `Source Safe not found for address ${args.safeAddress} on chain ${args.chainId}`,
        );
        return [CommonStatus.FAILED, targetChainId];
      }

      if (targetSafe) {
        if (!this.haveSameSetup(sourceSafe, targetSafe)) {
          return [BridgeStatus.DIFFERENT_SAFE_SETUP, targetChainId];
        }
        return undefined;
      } else {
        const [safeCreationData, targetChain] = await Promise.all([
          this.getSafeCreationData({
            chainId: args.chainId,
            safeAddress: args.safeAddress,
          }),
          this.chainsRepository.getChain(targetChainId),
        ]);

        if (!this.isNetworkCompatible(targetChain, safeCreationData)) {
          return [BridgeStatus.INCOMPATIBLE_SAFE, targetChainId];
        }

        return [BridgeStatus.MISSING_OWNERSHIP, targetChainId];
      }
    } catch (error) {
      this.loggingService.warn(
        `Failed to analyze target chain compatibility: ${error}`,
      );
      return [CommonStatus.FAILED, targetChainId];
    }
  }

  /**
   * Gets Safe data.
   * @param {string} args.chainId - The chain ID.
   * @param {Address} args.safeAddress - The Safe address.
   * @returns {Promise<Safe | null>} The Safe data, or null if not found.
   */
  private async getSafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Safe | null> {
    try {
      const transactionApi = await this.transactionApiManager.getApi(
        args.chainId,
      );
      const safe = await transactionApi.getSafe(args.safeAddress);
      return SafeSchema.parse(safe);
    } catch (error) {
      this.loggingService.warn(
        `Failed to get Safe by address ${args.safeAddress}: ${error}`,
      );
      return null;
    }
  }

  /**
   * Gets the safe creation data.
   * @param {string} args.chainId - The chain ID.
   * @param {Address} args.safeAddress - The Safe address.
   * @returns {Promise<SafeCreationData>} The Safe creation data.
   */
  private async getSafeCreationData({
    chainId,
    safeAddress,
  }: {
    chainId: string;
    safeAddress: Address;
  }): Promise<SafeCreationData> {
    const creationTransaction =
      await this.transactionsService.getCreationTransaction({
        chainId,
        safeAddress,
      });

    if (
      !creationTransaction ||
      !creationTransaction.masterCopy ||
      !creationTransaction.setupData ||
      !creationTransaction.dataDecoded?.parameters ||
      creationTransaction.setupData === '0x'
    ) {
      throw new Error(
        `Safe creation information not found or incomplete for ${safeAddress} on chain ${chainId}`,
      );
    }

    const safeVersion = this.determineMasterCopyVersion(
      creationTransaction.masterCopy,
      chainId,
    );

    const creationParameters = creationTransaction.dataDecoded.parameters;

    const safeAccountConfig = {
      owners: this.parseOwners(creationParameters[0].value),
      threshold: Number(creationParameters[1].value),
      to: getAddress(creationParameters[2].value as string),
      data: creationParameters[3].value as Hex,
      fallbackHandler: getAddress(creationParameters[4].value as string),
      paymentToken: getAddress(creationParameters[5].value as string),
      payment: Number(creationParameters[6].value),
      paymentReceiver: getAddress(creationParameters[7].value as string),
    };

    return {
      factoryAddress: getAddress(creationTransaction.factoryAddress),
      masterCopy: getAddress(creationTransaction.masterCopy),
      safeAccountConfig,
      safeVersion,
    };
  }

  /**
   * Parses and validates owners from creation parameters.
   * @param {unknown} ownersValue - The owners value from creation parameters.
   * @returns {Array<Address>} The parsed and validated owner addresses.
   */
  private parseOwners(ownersValue: unknown): Array<Address> {
    if (!Array.isArray(ownersValue)) {
      throw new Error('Owners parameter must be an array');
    }
    return ownersValue.map((owner) => getAddress(owner as string));
  }

  /**
   * Determines the master copy version.
   * @param {string} masterCopy - The master copy address.
   * @param {string} chainId - The chain ID.
   * @returns {SafeVersion | undefined} The Safe version if found, undefined otherwise.
   */
  private determineMasterCopyVersion(
    masterCopy: string,
    chainId: string,
  ): SafeVersion | undefined {
    return SAFE_VERSIONS.find((version) => {
      const isL1Singleton = isL1SingletonDeployed({
        version,
        chainId,
        address: getAddress(masterCopy),
      });
      const isL2Singleton = isL2SingletonDeployed({
        version,
        chainId,
        address: getAddress(masterCopy),
      });
      return isL1Singleton || isL2Singleton;
    });
  }

  /**
   * Checks if two Safes have the same setup.
   * @param {Safe} sourceSafe - The source Safe.
   * @param {Safe} targetSafe - The target Safe.
   * @returns {boolean} True if both Safes have the same owners and threshold.
   */
  private haveSameSetup(sourceSafe: Safe, targetSafe: Safe): boolean {
    const sourceSafeOwners = sourceSafe.owners.map(getAddress);
    const targetSafeOwners = targetSafe.owners.map(getAddress);

    const ownersMatch =
      sourceSafeOwners.length === targetSafeOwners.length &&
      sourceSafeOwners.every((owner) => targetSafeOwners.includes(owner));

    return ownersMatch && sourceSafe.threshold === targetSafe.threshold;
  }

  /**
   * Checks if the network is compatible with the safe creation data.
   * @param {Chain} chain - The chain.
   * @param {SafeCreationData} safeCreationData - The safe creation data.
   * @returns {boolean} True if the network is compatible.
   */
  private isNetworkCompatible(
    chain: Chain,
    safeCreationData: SafeCreationData,
  ): boolean {
    return RecipientAnalysisService.MULTICHAIN_SUPPORTED_VERSIONS.some(
      (version) =>
        this.checkVersionCompatibility(chain, safeCreationData, version),
    );
  }

  /**
   * Checks if a specific Safe version is compatible with the target chain.
   * @param {Chain} chain - The target chain.
   * @param {SafeCreationData} safeCreationData - The Safe creation data.
   * @param {SafeVersion} version - The Safe version to check.
   * @returns {boolean} True if the version is compatible with the target chain.
   */
  private checkVersionCompatibility(
    chain: Chain,
    safeCreationData: SafeCreationData,
    version: SafeVersion,
  ): boolean {
    const isL2Singleton = isL2SingletonDeployed({
      version,
      chainId: chain.chainId,
      address: safeCreationData.masterCopy,
    });

    const masterCopyExists =
      isL1SingletonDeployed({
        version,
        chainId: chain.chainId,
        address: safeCreationData.masterCopy,
      }) || isL2Singleton;

    const proxyFactoryExists = isProxyFactoryDeployed({
      version,
      chainId: chain.chainId,
      address: safeCreationData.factoryAddress,
    });

    const fallbackHandlerExists = isFallbackHandlerDeployed({
      version,
      chainId: chain.chainId,
      address: safeCreationData.safeAccountConfig.fallbackHandler,
    });

    const includesSetupToL2 =
      safeCreationData.safeAccountConfig.to !== zeroAddress;

    const areSetupToL2ConditionsMet =
      !includesSetupToL2 ||
      hasCanonicalDeploymentSafeToL2Setup({
        chainId: chain.chainId,
        version: '1.4.1',
      });

    const isMigrationRequired = isL2Singleton && !includesSetupToL2 && chain.l2;

    const areMigrationConditionsMet =
      !isMigrationRequired ||
      hasCanonicalDeploymentSafeToL2Migration({
        chainId: chain.chainId,
        version: '1.4.1',
      });

    return (
      masterCopyExists &&
      proxyFactoryExists &&
      fallbackHandlerExists &&
      areSetupToL2ConditionsMet &&
      areMigrationConditionsMet
    );
  }

  /**
   * Maps a recipient or bridge status to an analysis result.
   * @param {T} args.type - The recipient or bridge status.
   * @param {number} [args.interactions] - The number of interactions with the recipient (if applicable).
   * @param {string} [args.error] - The reason for failure (if applicable).
   * @param {string} [args.targetChainId] - The target chain ID (optional, only included for bridge-related statuses).
   * @returns {AnalysisResult<T> & { targetChainId?: string }} The recipient analysis result.
   * @template T
   */
  private mapToAnalysisResult<
    T extends RecipientStatus | BridgeStatus | CommonStatus,
  >(args: {
    type: T;
    interactions?: number;
    error?: string;
    targetChainId?: string;
  }): AnalysisResult<T> & { targetChainId?: string } {
    const { type, interactions, error, targetChainId } = args;
    const severity = SEVERITY_MAPPING[type];
    const title = TITLE_MAPPING[type];
    const description = DESCRIPTION_MAPPING[type]({ interactions, error });

    return {
      severity,
      type,
      title,
      description,
      ...(targetChainId !== undefined && { targetChainId }),
    };
  }
}
