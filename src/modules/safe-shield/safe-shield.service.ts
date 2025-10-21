import { Inject, Injectable } from '@nestjs/common';
import { RecipientAnalysisService } from './recipient-analysis/recipient-analysis.service';
import { ContractAnalysisService } from './contract-analysis/contract-analysis.service';
import { ThreatAnalysisService } from './threat-analysis/threat-analysis.service';
import { type Address, type Hex } from 'viem';
import type {
  ContractAnalysisResponse,
  RecipientAnalysisResponse,
  CounterpartyAnalysisResponse,
  RecipientInteractionAnalysisResponse,
  ThreatAnalysisResponse,
} from './entities/analysis-responses.entity';
import type {
  RecipientAnalysisResult,
  ContractAnalysisResult,
  ThreatAnalysisResult,
} from './entities/analysis-result.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { mapDecodedTransactions } from './utils/transaction-mapping.utils';
import { TransactionsService } from '@/routes/transactions/transactions.service';
import { Operation } from '@/domain/safe/entities/operation.entity';
import type { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';
import {
  ContractStatusGroup,
  RecipientStatusGroup,
} from '@/modules/safe-shield/entities/status-group.entity';
import { ThreatAnalysisRequest } from '@/modules/safe-shield/entities/analysis-requests.entity';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { ChainSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { RISK_MITIGATION } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.constants';
import { createFailedAnalysisResult } from './utils/common';

/**
 * Main orchestration service for Safe Shield transaction analysis.
 *
 * This service coordinates all analysis types (recipient, contract, threat)
 * and provides the main entry points for transaction safety checks.
 * It acts as a facade that delegates to specialized analysis services.
 */
@Injectable()
export class SafeShieldService {
  constructor(
    private readonly recipientAnalysisService: RecipientAnalysisService,
    private readonly contractAnalysisService: ContractAnalysisService,
    private readonly threatAnalysisService: ThreatAnalysisService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly transactionsService: TransactionsService,
    @Inject(IConfigApi)
    private readonly configApi: IConfigApi,
  ) {}

  /**
   * Performs combined recipient and contract analysis for a transaction.
   *
   * @param args - Analysis parameters
   * @param args.chainId - The chain ID
   * @param args.safeAddress - The Safe address
   * @param args.tx - The Safe transaction
   * @param args.tx.to - The transaction recipient address
   * @param args.tx.data - The transaction data
   * @param args.tx.value - The transaction value
   * @param args.tx.operation - The transaction operation
   * @returns Counterparty analysis results containing both recipient and contract insights grouped by status group
   */
  async analyzeCounterparty({
    chainId,
    safeAddress,
    tx,
  }: {
    chainId: string;
    safeAddress: Address;
    tx: {
      to: Address;
      value: string;
      data: Hex;
      operation: Operation;
    };
  }): Promise<CounterpartyAnalysisResponse> {
    const { transactions, txInfo } = await this.decodeTransaction({
      chainId,
      safeAddress,
      tx,
    });

    const [recipientsResult, contractsResult] = await Promise.allSettled([
      this.analyzeRecipients(chainId, safeAddress, transactions, txInfo),
      this.analyzeContracts(chainId, safeAddress, transactions),
    ]);

    return {
      recipient:
        recipientsResult.status === 'fulfilled'
          ? recipientsResult.value
          : this.handleFailedAnalysis(
              tx.to,
              'RECIPIENT_INTERACTION',
              recipientsResult.reason,
            ),
      contract:
        contractsResult.status === 'fulfilled'
          ? contractsResult.value
          : this.handleFailedAnalysis(
              tx.to,
              'CONTRACT_VERIFICATION',
              contractsResult.reason,
            ),
    };
  }

  /**
   * Analyzes recipients in a transaction, including inner calls if it's a multiSend.
   *
   * @param chainId - The chain ID
   * @param safeAddress - The Safe address
   * @param transactions - A list of decoded transactions
   * @param txInfo - The transaction recipient address
   * @returns Map of recipient addresses to their analysis results
   */
  async analyzeRecipients(
    chainId: string,
    safeAddress: Address,
    transactions: Array<DecodedTransactionData>,
    txInfo?: TransactionInfo,
  ): Promise<RecipientAnalysisResponse> {
    if (transactions.length > 0 || txInfo) {
      return this.recipientAnalysisService.analyze({
        chainId,
        safeAddress,
        transactions,
        txInfo,
      });
    }

    return {};
  }

  /**
   * Analyzes a single recipient address.
   *
   * @param chainId - The chain ID
   * @param safeAddress - The Safe address
   * @param recipientAddress - The recipient address to analyze
   * @returns Analysis result for group RECIPIENT_INTERACTION
   */
  async analyzeRecipient(
    chainId: string,
    safeAddress: Address,
    recipientAddress: Address,
  ): Promise<RecipientInteractionAnalysisResponse> {
    const interactionResult =
      await this.recipientAnalysisService.analyzeInteractions({
        chainId,
        safeAddress,
        recipient: recipientAddress,
      });

    return {
      RECIPIENT_INTERACTION: [interactionResult],
    };
  }

  /**
   * Analyzes contracts in a transaction, including inner calls if it's a multiSend.
   *
   * @param chainId - The chain ID
   * @param safeAddress - The Safe address
   * @param transactions - A list of decoded transactions
   * @returns Map of contract addresses to their analysis results
   */
  async analyzeContracts(
    chainId: string,
    safeAddress: Address,
    transactions: Array<DecodedTransactionData>,
  ): Promise<ContractAnalysisResponse> {
    if (transactions.length) {
      return this.contractAnalysisService.analyze({
        chainId,
        safeAddress,
        transactions,
      });
    }

    return {};
  }

  /**
   * Analyze transaction for any potential threats.
   *
   * @param args - Analysis parameters
   * @param args.chainId - The chain ID
   * @param args.safeAddress - The Safe address
   * @param args.request - The transaction data/ sign message as TypedData
   * @returns A threat analysis response
   */
  async analyzeThreats({
    chainId,
    safeAddress,
    request,
  }: {
    chainId: string;
    safeAddress: Address;
    request: ThreatAnalysisRequest;
  }): Promise<ThreatAnalysisResponse> {
    try {
      const isAnalysisEnabled = await this.isBlockaidEnabled(chainId);
      if (!isAnalysisEnabled) {
        return {};
      }

      return await this.threatAnalysisService.analyze({
        chainId,
        safeAddress,
        request,
      });
    } catch (error) {
      return createFailedAnalysisResult<ThreatAnalysisResult>(
        this.loggingService,
        'THREAT',
        'Threat',
        error,
      ) as ThreatAnalysisResponse;
    }
  }

  private async isBlockaidEnabled(chainId: string): Promise<boolean> {
    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);

    return chain.features.includes(RISK_MITIGATION);
  }

  /**
   * Decodes a transaction.
   * @param args - The arguments for decoding the transaction.
   * @param args.chainId - The chain ID.
   * @param args.safeAddress - The Safe address.
   * @param args.tx - The transaction.
   * @returns The decoded transaction and additional tx info (optional).
   */
  private async decodeTransaction({
    chainId,
    safeAddress,
    tx,
  }: {
    chainId: string;
    safeAddress: Address;
    tx: {
      to: Address;
      data: Hex;
      value: string;
      operation: Operation;
    };
  }): Promise<{
    transactions: Array<DecodedTransactionData>;
    txInfo?: TransactionInfo;
  }> {
    try {
      const txPreview = await this.transactionsService.previewTransaction({
        chainId,
        safeAddress,
        previewTransactionDto: tx,
      });

      const decodedTransactionData: DecodedTransactionData = {
        ...tx,
        dataDecoded: txPreview?.txData?.dataDecoded ?? null,
      };

      const transactions = mapDecodedTransactions(decodedTransactionData);

      return {
        transactions,
        txInfo: txPreview?.txInfo,
      };
    } catch (error) {
      this.loggingService.warn(`Failed to decode transaction: ${error}`);
      return { transactions: [] };
    }
  }

  /**
   * Handles failed analysis by creating a FAILED result placeholder.
   *
   * @param targetAddress - The address to attach the failure to
   * @param statusGroup - The status group for the failure
   * @param reason - The error reason from the rejected promise
   * @returns Analysis response with FAILED status
   */
  private handleFailedAnalysis<
    T extends RecipientAnalysisResponse | ContractAnalysisResponse,
  >(
    targetAddress: Address,
    statusGroup: RecipientStatusGroup | ContractStatusGroup,
    reason?: unknown,
  ): T {
    const type = (RecipientStatusGroup as ReadonlyArray<string>).includes(
      statusGroup,
    )
      ? 'Recipient'
      : 'Contract';

    return {
      [targetAddress]: createFailedAnalysisResult<
        RecipientAnalysisResult | ContractAnalysisResult
      >(this.loggingService, statusGroup, type, reason),
    } as T;
  }
}
