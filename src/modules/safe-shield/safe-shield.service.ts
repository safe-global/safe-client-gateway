import { Inject, Injectable } from '@nestjs/common';
import { RecipientAnalysisService } from './recipient-analysis/recipient-analysis.service';
import { ContractAnalysisService } from './contract-analysis/contract-analysis.service';
import { ThreatAnalysisService } from './threat-analysis/threat-analysis.service';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { DataDecodedService } from '@/routes/data-decode/data-decoded.service';
import { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import type { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { type Address, type Hex } from 'viem';
import type { RecipientAnalysisResponse } from './entities/analysis-responses.entity';
import type {
  DecodedTransactionData,
  TransactionData,
} from '@/modules/safe-shield/entities/transaction-data.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { mapDecodedTransactions } from './utils/transaction-mapping.utils';

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
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly dataDecodedService: DataDecodedService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Analyzes recipients in a transaction, including inner calls if it's a multiSend.
   *
   * @param args - Analysis parameters
   * @param args.chainId - The chain ID
   * @param args.safeAddress - The Safe address
   * @param args.to - The transaction recipient address
   * @param args.data - The transaction data (may contain multiSend)
   * @returns Map of recipient addresses to their analysis results
   */
  async analyzeRecipient(args: {
    chainId: string;
    safeAddress: Address;
    to: Address;
    data: Hex;
  }): Promise<RecipientAnalysisResponse> {
    const transactions = await this.extractTransactions(
      args.chainId,
      args.to,
      args.data,
    );

    return this.recipientAnalysisService.analyze({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      transactions,
    });
  }

  /**
   * Extracts all transactions from a transaction request.
   * If it's a multiSend, extracts all inner transactions. Otherwise, returns the main transaction.
   *
   * @param chainId - The chain ID for decoding context
   * @param to - The main transaction recipient
   * @param data - The transaction data
   * @returns Array of transaction objects with operation, to, value, data, and decoded information
   */
  async extractTransactions(
    chainId: string,
    to: Address,
    data: Hex,
    operation: number = 0,
    value: bigint | string = BigInt(0),
  ): Promise<Array<DecodedTransactionData>> {
    let rawTransactions: Array<TransactionData> = [
      { operation, to, value, data },
    ];

    // Extract the inner transactions if it's a multiSend
    if (this.multiSendDecoder.helpers.isMultiSend(data)) {
      try {
        rawTransactions = this.multiSendDecoder.mapMultiSendTransactions(data);
      } catch (error) {
        this.loggingService.warn(
          `Failed to decode multiSend transaction: ${error}`,
        );
      }
    }

    // Decode the transactions
    const decodedTransactions = await Promise.all(
      rawTransactions.map(async (tx) => ({
        ...tx,
        dataDecoded:
          tx.data === '0x'
            ? null
            : await this.decodeTransactionData(chainId, tx.to, tx.data),
      })),
    );

    // Map the decoded transactions to a flat array
    return decodedTransactions.reduce<Array<DecodedTransactionData>>(
      (acc, curr) => [...acc, ...mapDecodedTransactions(curr)],
      [],
    );
  }

  /**
   * Decodes transaction data using the DataDecodedService.
   *
   * @param chainId - The chain ID
   * @param to - The transaction recipient address
   * @param data - The transaction data to decode
   * @returns Promise<DataDecoded | null> - Decoded transaction data or null if decoding fails
   */
  private async decodeTransactionData(
    chainId: string,
    to: Address,
    data: Hex,
  ): Promise<DataDecoded | null> {
    try {
      return await this.dataDecodedService.getDataDecoded({
        chainId,
        getDataDecodedDto: new TransactionDataDto(data, to),
      });
    } catch (error) {
      this.loggingService.warn(`Failed to decode transaction data: ${error}`);
      return null;
    }
  }
}
