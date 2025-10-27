import { Inject, Injectable } from '@nestjs/common';
import { RecipientAnalysisService } from './recipient-analysis/recipient-analysis.service';
import { ContractAnalysisService } from './contract-analysis/contract-analysis.service';
import { ThreatAnalysisService } from './threat-analysis/threat-analysis.service';
import { type Address, type Hex } from 'viem';
import type {
  ContractAnalysisResponse,
  RecipientAnalysisResponse,
  CounterpartyAnalysisResponse,
  SingleRecipientAnalysisResponse,
  ThreatAnalysisResponse,
} from './entities/analysis-responses.entity';
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
import { FF_RISK_MITIGATION } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.constants';
import { asError } from '@/logging/utils';
import {
  COMMON_DESCRIPTION_MAPPING,
  COMMON_SEVERITY_MAPPING,
} from '@/modules/safe-shield/entities/common-status.constants';

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
   * @param {string} args.chainId - The chain ID
   * @param {Address} args.safeAddress - The Safe address
   * @param {Address} args.tx.to - The transaction recipient address
   * @param {Hex} args.tx.data - The transaction data
   * @param {string} args.tx.value - The transaction value
   * @param {Operation} args.tx.operation - The transaction operation
   * @returns {Promise<CounterpartyAnalysisResponse>} Counterparty analysis results containing both recipient and contract insights grouped by status group
   */
  public async analyzeCounterparty({
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
   * @param {string} chainId - The chain ID
   * @param {Address} safeAddress - The Safe address
   * @param {Array<DecodedTransactionData>} transactions - A list of decoded transactions
   * @param {TransactionInfo} txInfo - The transaction info (optional)
   * @returns {Promise<RecipientAnalysisResponse>} Map of recipient addresses to their analysis results
   */
  public async analyzeRecipients(
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
   * @param {string} chainId - The chain ID
   * @param {Address} safeAddress - The Safe address
   * @param {Address} recipientAddress - The recipient address to analyze
   * @returns {Promise<SingleRecipientAnalysisResponse>} Analysis result for groups RECIPIENT_INTERACTION and RECIPIENT_ACTIVITY
   */
  public async analyzeRecipient(
    chainId: string,
    safeAddress: Address,
    recipientAddress: Address,
  ): Promise<SingleRecipientAnalysisResponse> {
    return this.recipientAnalysisService.analyzeRecipient(
      chainId,
      safeAddress,
      recipientAddress,
    );
  }

  /**
   * Analyzes contracts in a transaction, including inner calls if it's a multiSend.
   *
   * @param {string} chainId - The chain ID
   * @param {Address} safeAddress - The Safe address
   * @param {Array<DecodedTransactionData>} transactions - A list of decoded transactions
   * @returns {Promise<ContractAnalysisResponse>} Map of contract addresses to their analysis results
   */
  public async analyzeContracts(
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
   * @param {string} args.chainId - The chain ID
   * @param {Address} args.safeAddress - The Safe address
   * @param {ThreatAnalysisRequest} args.request - The transaction data/ sign message as TypedData
   * @returns {Promise<ThreatAnalysisResponse>} A threat analysis response
   */
  public async analyzeThreats({
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
      this.loggingService.warn(`The threat analysis failed. ${error}`);
      return this.threatAnalysisService.failedAnalysisResponse();
    }
  }

  private async isBlockaidEnabled(chainId: string): Promise<boolean> {
    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);

    return chain.features.includes(FF_RISK_MITIGATION);
  }

  /**
   * Decodes a transaction.
   * @param {string} args.chainId - The chain ID.
   * @param {Address} args.safeAddress - The Safe address.
   * @param {Address} args.tx.to - The transaction recipient address.
   * @param {Hex} args.tx.data - The transaction data.
   * @param {string} args.tx.value - The transaction value.
   * @param {Operation} args.tx.operation - The transaction operation.
   * @returns {Promise<{transactions: Array<DecodedTransactionData>, txInfo?: TransactionInfo}>} The decoded transaction and additional tx info (optional).
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
   * @param {Address} targetAddress - The address to attach the failure to
   * @param {StatusGroup} statusGroup - The status group for the failure
   * @param {unknown} reason - The error reason from the rejected promise
   * @returns {<RecipientAnalysisResponse | ContractAnalysisResponse>} Analysis response with FAILED status
   */
  private handleFailedAnalysis<
    T extends RecipientAnalysisResponse | ContractAnalysisResponse,
  >(
    targetAddress: Address,
    statusGroup: RecipientStatusGroup | ContractStatusGroup,
    reason?: unknown,
  ): T {
    const error = asError(reason);
    this.loggingService.warn(`The counterparty analysis failed. ${error}`);

    const type = (RecipientStatusGroup as ReadonlyArray<string>).includes(
      statusGroup,
    )
      ? 'Recipient'
      : 'Contract';

    return {
      [targetAddress]: {
        [statusGroup]: [
          {
            type: 'FAILED',
            severity: COMMON_SEVERITY_MAPPING.FAILED,
            title: `${type} analysis failed`,
            description: COMMON_DESCRIPTION_MAPPING.FAILED({
              error: error?.message,
            }),
          },
        ],
      },
    } as T;
  }
}
