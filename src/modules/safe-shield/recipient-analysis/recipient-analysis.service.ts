import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { TransferPageSchema } from '@/domain/safe/entities/transfer.entity';
import type { RecipientAnalysisResult } from '@/modules/safe-shield/entities/analysis-result.entity';
import { Inject, Injectable } from '@nestjs/common';
import { getAddress, type Address } from 'viem';
import {
  SEVERITY_MAPPING,
  TITLE_MAPPING,
  DESCRIPTION_MAPPING,
} from './recipient-analysis.constants';
import type { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import type { BridgeStatus } from '@/modules/safe-shield/entities/bridge-status.entity';
import type { RecipientStatusGroup } from '@/modules/safe-shield/entities/status-group.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { RecipientAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';
import uniq from 'lodash/uniq';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { extractRecipients } from '../utils/recipient-extraction.utils';
import { logCacheHit, logCacheMiss } from '@/modules/safe-shield/utils/common';

/**
 * Service responsible for analyzing transaction recipients and bridge configurations.
 */
@Injectable()
export class RecipientAnalysisService {
  private readonly defaultExpirationTimeInSeconds: number;

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
  }): Promise<RecipientAnalysisResponse> {
    const recipients = extractRecipients(args.transactions, this.erc20Decoder);

    const cacheDir = CacheRouter.getRecipientAnalysisCacheDir({
      chainId: args.chainId,
      recipients,
    });

    const cached = await this.cacheService.hGet(cacheDir);
    if (cached) {
      logCacheHit(cacheDir, this.loggingService);
      return JSON.parse(cached) as RecipientAnalysisResponse;
    }
    logCacheMiss(cacheDir, this.loggingService);

    const analysisResults: RecipientAnalysisResponse = {};
    for (const recipient of recipients) {
      const result = await this.analyzeRecipient({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        recipient,
      });

      analysisResults[recipient] = result;
    }

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(analysisResults),
      this.defaultExpirationTimeInSeconds,
    );

    return analysisResults;
  }

  /**
   * Analyzes the recipient and bridge status.
   * @param args - The arguments for the analysis.
   * @param args.chainId - The chain ID.
   * @param args.safeAddress - The Safe address.
   * @param args.recipient - The recipient address.
   * @returns The analysis results.
   */
  async analyzeRecipient(args: {
    chainId: string;
    safeAddress: Address;
    recipient: Address;
  }): Promise<Record<RecipientStatusGroup, Array<RecipientAnalysisResult>>> {
    const recipientInteractionResults = await this.analyzeInteractions(args);
    return {
      RECIPIENT_INTERACTION: [recipientInteractionResults],
      BRIDGE: [],
    };
  }

  /**
   * Analyzes the interactions between a Safe and a recipient.
   * @param args - The arguments for the analysis.
   * @param args.chainId - The chain ID.
   * @param args.safeAddress - The Safe address.
   * @param args.recipient - The recipient address.
   * @returns The analysis result.
   */
  async analyzeInteractions(args: {
    chainId: string;
    safeAddress: Address;
    recipient: Address;
  }): Promise<RecipientAnalysisResult> {
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
    const type = interactions > 0 ? 'KNOWN_RECIPIENT' : 'NEW_RECIPIENT';

    return this.mapToAnalysisResult(type, interactions);
  }

  /**
   * Maps a recipient or bridge status to an analysis result.
   * @param type - The recipient or bridge status.
   * @param interactions - The number of interactions with the recipient.
   * @returns The analysis result.
   */
  private mapToAnalysisResult(
    type: RecipientStatus,
    interactions: number,
  ): RecipientAnalysisResult;
  private mapToAnalysisResult(type: BridgeStatus): RecipientAnalysisResult;
  private mapToAnalysisResult(
    type: RecipientStatus | BridgeStatus,
    interactions?: number,
  ): RecipientAnalysisResult {
    const severity = SEVERITY_MAPPING[type];
    const title = TITLE_MAPPING[type];
    const description = DESCRIPTION_MAPPING[type](interactions ?? 0);

    return { severity, type, title, description };
  }

  /**
   * Extracts the unique recipients from transactions.
   * @param transactions - The transactions.
   * @returns The unique recipient addresses.
   */
  private extractRecipients(
    transactions: Array<DecodedTransactionData>,
  ): Array<Address> {
    return uniq(
      transactions
        .map((tx) => this.extractRecipient(tx))
        .filter((recipient) => !!recipient),
    );
  }

  /**
   * Extracts the recipient address from a transaction.
   * @param tx - The transaction.
   * @returns The recipient address or undefined if the transaction is not a transfer.
   */
  private extractRecipient({
    dataDecoded,
    data,
    to,
  }: DecodedTransactionData): Address | undefined {
    // ExecTransaction with no data is a transfer
    if (
      dataDecoded?.method === 'execTransaction' &&
      dataDecoded?.parameters?.[2].value === '0x'
    ) {
      return getAddress(dataDecoded?.parameters?.[0].value as string);
    }

    // ERC-20 transfer
    if (this.erc20Decoder.helpers.isTransfer(data)) {
      return getAddress(dataDecoded?.parameters?.[0].value as string);
    }

    // ERC-20 transferFrom
    if (this.erc20Decoder.helpers.isTransferFrom(data)) {
      return getAddress(dataDecoded?.parameters?.[1].value as string);
    }

    // Native transfer
    if (data === '0x' || !dataDecoded) {
      return getAddress(to);
    }
  }
}
