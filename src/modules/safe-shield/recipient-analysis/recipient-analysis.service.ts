import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { TransferPageSchema } from '@/domain/safe/entities/transfer.entity';
import type { RecipientAnalysisResult } from '@/modules/safe-shield/entities/analysis-result.entity';
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import {
  SEVERITY_MAPPING,
  TITLE_MAPPING,
  DESCRIPTION_MAPPING,
} from './recipient-analysis.constants';
import type { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import type { BridgeStatus } from '@/modules/safe-shield/entities/bridge-status.entity';
import type { RecipientStatusGroup } from '@/modules/safe-shield/entities/status-group.entity';

/**
 * Service responsible for analyzing transaction recipients and bridge configurations.
 */
@Injectable()
export class RecipientAnalysisService {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  /**
   * Analyzes the recipient and bridge status.
   * @param args - The arguments for the analysis.
   * @param args.chainId - The chain ID.
   * @param args.safeAddress - The Safe address.
   * @param args.recipient - The recipient address.
   * @returns The analysis results.
   */
  async analyze(args: {
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
}
