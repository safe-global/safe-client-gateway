import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { TransferPageSchema } from '@/domain/safe/entities/transfer.entity';
import type {
  AnalysisResult,
  CommonStatus,
} from '@/modules/safe-shield/entities/analysis-result.entity';
import { Inject, Injectable } from '@nestjs/common';
import { getAddress, Hex, zeroAddress, type Address } from 'viem';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { SafeSchema } from '@/domain/safe/entities/schemas/safe.schema';
import {
  SEVERITY_MAPPING,
  TITLE_MAPPING,
  DESCRIPTION_MAPPING,
} from './recipient-analysis.constants';
import type { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import type { BridgeStatus } from '@/modules/safe-shield/entities/bridge-status.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { RecipientAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { extractRecipients } from '../utils/recipient-extraction.utils';
import { logCacheHit, logCacheMiss } from '@/modules/safe-shield/utils/common';
import { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';
import {
  BridgeAndSwapTransactionInfo,
  isBridgeAndSwapTransactionInfo,
} from '@/routes/transactions/entities/bridge/bridge-info.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { TransactionsService } from '@/routes/transactions/transactions.service';
import {
  hasCanonicalDeploymentSafeToL2Migration,
  hasCanonicalDeploymentSafeToL2Setup,
  isFallbackHandlerDeployed,
  isL1SingletonDeployed,
  isL2SingletonDeployed,
  isProxyFactoryDeployed,
} from '@/domain/common/utils/deployments';
import { Chain } from '@/routes/chains/entities/chain.entity';
import { merge } from 'lodash';
import type { SafeCreationData } from '@/modules/safe-shield/entities/safe-creation-data.entity';

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
   * @param args - The arguments for the analysis.
   * @param args.chainId - The chain ID.
   * @param args.safeAddress - The Safe address.
   * @param args.transactions - The transactions to analyze.
   * @param args.txInfo - The transaction info.
   * @returns The analysis results.
   */
  async analyze(args: {
    chainId: string;
    safeAddress: Address;
    transactions: Array<DecodedTransactionData>;
    txInfo?: TransactionInfo;
  }): Promise<RecipientAnalysisResponse> {
    const recipients = extractRecipients(args.transactions, this.erc20Decoder);

    const cacheDir = CacheRouter.getRecipientAnalysisCacheDir({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      recipients,
      txInfo: args.txInfo,
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
        this.analyseRecipients({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          recipients,
        }),
        this.analyzeBridge({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          txInfo: args.txInfo,
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
   */
  private async analyseRecipients(args: {
    chainId: string;
    safeAddress: Address;
    recipients: Array<Address>;
  }): Promise<RecipientAnalysisResponse> {
    const { chainId, safeAddress, recipients } = args;
    return Object.fromEntries(
      await Promise.all(
        recipients.map(async (recipient) => [
          recipient,
          {
            RECIPIENT_INTERACTION: [
              await this.analyzeInteractions({
                chainId,
                safeAddress,
                recipient,
              }),
            ],
          },
        ]),
      ),
    );
  }

  /**
   * Analyzes the interactions between a Safe and a recipient.
   */
  async analyzeInteractions(args: {
    chainId: string;
    safeAddress: Address;
    recipient: Address;
  }): Promise<AnalysisResult<RecipientStatus | CommonStatus>> {
    try {
      const transactionApi = await this.transactionApiManager.getApi(
        args.chainId,
      );

      const page = await transactionApi.getTransfers({
        safeAddress: args.safeAddress,
        to: args.recipient,
        limit: 1,
      });

      const transferPage = TransferPageSchema.parse(page);
      const interactions = transferPage.count ?? 0;
      const type = interactions > 0 ? 'RECURRING_RECIPIENT' : 'NEW_RECIPIENT';

      return this.mapToAnalysisResult({ type, interactions });
    } catch (error) {
      this.loggingService.warn(
        `Failed to analyze recipient interactions: ${error}`,
      );
      return this.mapToAnalysisResult({
        type: 'FAILED',
        reason: 'recipient interactions unavailable',
      });
    }
  }

  /**
   * Analyzes bridge compatibility for cross-chain operations.
   */
  async analyzeBridge(args: {
    chainId: string;
    safeAddress: Address;
    txInfo?: TransactionInfo;
  }): Promise<RecipientAnalysisResponse> {
    if (!args.txInfo || !isBridgeAndSwapTransactionInfo(args.txInfo)) {
      return {};
    }

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
          BRIDGE: [
            this.mapToAnalysisResult({
              type: resultStatus,
              reason:
                resultStatus === 'FAILED'
                  ? 'bridge compatibility unavailable'
                  : undefined,
              targetChainId,
            }),
          ],
        },
      };
    }

    // If the bridge recipient is not the same as the Safe address, we need to analyse the recipient
    return this.analyseRecipients({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      recipients: [bridgeRecipient],
    });
  }

  /**
   * Analyzes compatibility between source and target chain Safes.
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
        return ['UNSUPPORTED_NETWORK', targetChainId];
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
        return ['FAILED', targetChainId];
      }

      if (targetSafe) {
        if (!this.haveSameSetup(sourceSafe, targetSafe)) {
          return ['DIFFERENT_SAFE_SETUP', targetChainId];
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
          return ['INCOMPATIBLE_SAFE', targetChainId];
        }

        return ['MISSING_OWNERSHIP', targetChainId];
      }
    } catch (error) {
      this.loggingService.warn(
        `Failed to analyze target chain compatibility: ${error}`,
      );
      return ['FAILED', targetChainId];
    }
  }

  /**
   * Gets Safe data.
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
   */
  private parseOwners(ownersValue: unknown): Array<Address> {
    if (!Array.isArray(ownersValue)) {
      throw new Error('Owners parameter must be an array');
    }
    return ownersValue.map((owner) => getAddress(owner as string));
  }

  /**
   * Determines the master copy version.
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
   * @param chain - The chain.
   * @param safeCreationData - The safe creation data.
   * @returns True if the network is compatible.
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
   * @param type - The recipient or bridge status.
   * @param interactions - The number of interactions with the recipient (if applicable).
   * @param reason - The reason for failure (if applicable).
   * @param targetChainId - The target chain ID (optional, only included for bridge-related statuses).
   * @returns The recipient analysis result.
   */
  private mapToAnalysisResult<
    T extends RecipientStatus | BridgeStatus | CommonStatus,
  >(args: {
    type: T;
    interactions?: number;
    reason?: string;
    targetChainId?: string;
  }): AnalysisResult<T> & { targetChainId?: string } {
    const { type, interactions, reason, targetChainId } = args;
    const severity = SEVERITY_MAPPING[type];
    const title = TITLE_MAPPING[type];
    const description = DESCRIPTION_MAPPING[type]({ interactions, reason });

    return {
      severity,
      type,
      title,
      description,
      ...(targetChainId !== undefined && { targetChainId }),
    };
  }
}
