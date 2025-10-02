import { Inject, Injectable } from '@nestjs/common';
import { RecipientAnalysisService } from './recipient-analysis/recipient-analysis.service';
import { ContractAnalysisService } from './contract-analysis/contract-analysis.service';
import { ThreatAnalysisService } from './threat-analysis/threat-analysis.service';
import { type Address, type Hex } from 'viem';
import type { RecipientAnalysisResponse } from './entities/analysis-responses.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { mapDecodedTransactions } from './utils/transaction-mapping.utils';
import { TransactionsService } from '@/routes/transactions/transactions.service';
import { Operation } from '@/domain/safe/entities/operation.entity';
import type { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';

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
  ) {}

  /**
   * Analyzes recipients in a transaction, including inner calls if it's a multiSend.
   *
   * @param args - Analysis parameters
   * @param args.chainId - The chain ID
   * @param args.safeAddress - The Safe address
   * @param args.tx - The transaction data
   * @param args.tx.to - The transaction recipient address
   * @param args.tx.data - The transaction data (optional)
   * @param args.tx.value - The transaction value (optional)
   * @param args.tx.operation - The transaction operation (optional)
   * @returns Map of recipient addresses to their analysis results
   */
  async analyzeRecipient({
    chainId,
    safeAddress,
    tx,
  }: {
    chainId: string;
    safeAddress: Address;
    tx: {
      to: Address;
      data?: Hex;
      value?: bigint | string;
      operation?: Operation;
    };
  }): Promise<RecipientAnalysisResponse> {
    let transactions: Array<DecodedTransactionData> = [];

    try {
      const decodedTransaction = await this.decodeTransaction({
        chainId,
        safeAddress,
        tx,
      });

      transactions = decodedTransaction.transactions;
    } catch (error) {
      this.loggingService.warn(`Failed to decode transaction: ${error}`);
      return {};
    }

    return this.recipientAnalysisService.analyze({
      chainId,
      safeAddress,
      transactions,
    });
  }

  /**
   * Decodes a transaction.
   * @param args - The arguments for decoding the transaction.
   * @param args.chainId - The chain ID.
   * @param args.safeAddress - The Safe address.
   * @param args.tx - The transaction.
   * @returns The decoded transaction.
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
      data?: Hex;
      value?: bigint | string;
      operation?: Operation;
    };
  }): Promise<{
    transactions: Array<DecodedTransactionData>;
    txInfo: TransactionInfo;
  }> {
    const { data = '0x', value = '0', operation = Operation.CALL } = tx;

    const txPreview = await this.transactionsService.previewTransaction({
      chainId,
      safeAddress,
      previewTransactionDto: {
        ...tx,
        data,
        operation,
        value: value.toString(),
      },
    });

    const decodedTransactionData: DecodedTransactionData = {
      ...tx,
      data,
      operation,
      value,
      dataDecoded: txPreview?.txData?.dataDecoded ?? null,
    };

    return {
      transactions: mapDecodedTransactions(decodedTransactionData),
      txInfo: txPreview?.txInfo,
    };
  }
}
