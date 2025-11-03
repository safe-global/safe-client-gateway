import {
  BridgeStatus,
  StatusMessages,
  SubstatusesDone,
  SubstatusesFailed,
  SubstatusesPending,
} from '@/domain/bridge/entities/bridge-status.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { BridgeFee } from '@/routes/transactions/entities/bridge/fees.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

@ApiExtraModels(BridgeFee)
export class SwapTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.Swap] })
  override type = TransactionInfoType.Swap;

  @ApiProperty()
  recipient: AddressInfo;

  @ApiProperty({ type: BridgeFee, nullable: true })
  fees: BridgeFee | null;

  @ApiProperty()
  fromToken: TokenInfo;

  @ApiProperty()
  fromAmount: string;

  @ApiProperty()
  toToken: TokenInfo;

  @ApiProperty()
  toAmount: string;

  @ApiProperty({ type: String, nullable: true })
  lifiExplorerUrl: string | null;

  constructor(args: {
    recipient: AddressInfo;
    fees: BridgeFee | null;
    fromToken: TokenInfo;
    fromAmount: string;
    toToken: TokenInfo;
    toAmount: string;
    lifiExplorerUrl: string | null;
  }) {
    super(TransactionInfoType.Swap, null);

    this.recipient = args.recipient;
    this.fees = args.fees;
    this.fromToken = args.fromToken;
    this.fromAmount = args.fromAmount;
    this.toToken = args.toToken;
    this.toAmount = args.toAmount;
    this.lifiExplorerUrl = args.lifiExplorerUrl;
  }
}

@ApiExtraModels(BridgeFee, TokenInfo, AddressInfo)
export class BridgeAndSwapTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.SwapAndBridge] })
  override type = TransactionInfoType.SwapAndBridge;

  @ApiProperty()
  fromToken: TokenInfo;

  @ApiProperty()
  recipient: AddressInfo;

  @ApiProperty({ type: String, nullable: true })
  explorerUrl: string | null;

  @ApiProperty({ enum: [...StatusMessages, 'UNKNOWN', 'AWAITING_EXECUTION'] })
  status: BridgeStatus['status'] | 'AWAITING_EXECUTION';

  @ApiProperty({
    enum: [
      ...SubstatusesPending,
      ...SubstatusesDone,
      ...SubstatusesFailed,
      'UNKNOWN',
      'AWAITING_EXECUTION',
    ],
  })
  substatus: BridgeStatus['substatus'] | 'AWAITING_EXECUTION';

  @ApiProperty({ type: BridgeFee, nullable: true })
  fees: BridgeFee | null;

  @ApiProperty()
  fromAmount: string;

  @ApiProperty()
  toChain: string;

  @ApiProperty({ type: TokenInfo, nullable: true })
  toToken: TokenInfo | null;

  @ApiProperty({ type: String, nullable: true })
  toAmount: string | null;

  constructor(args: {
    fromToken: TokenInfo;
    fromAmount: string;
    recipient: AddressInfo;
    explorerUrl: string | null;
    status: BridgeStatus['status'] | 'AWAITING_EXECUTION';
    substatus: BridgeStatus['substatus'] | 'AWAITING_EXECUTION';
    fees: {
      tokenAddress: Address;
      integratorFee: string;
      lifiFee: string;
    } | null;
    toChain: string;
    toToken: TokenInfo | null;
    toAmount: string | null;
  }) {
    super(TransactionInfoType.SwapAndBridge, null);

    this.fromToken = args.fromToken;
    this.recipient = args.recipient;
    this.explorerUrl = args.explorerUrl;
    this.status = args.status;
    this.substatus = args.substatus;
    this.fees = args.fees;
    this.fromAmount = args.fromAmount;
    this.toChain = args.toChain;
    this.toToken = args.toToken;
    this.toAmount = args.toAmount;
  }
}

/**
 * Type guard to check if a TransactionInfo is a BridgeAndSwapTransactionInfo.
 * @param txInfo - The transaction info to check.
 * @returns True if the transaction info is a BridgeAndSwapTransactionInfo.
 */
export const isBridgeAndSwapTransactionInfo = (
  txInfo: TransactionInfo,
): txInfo is BridgeAndSwapTransactionInfo =>
  txInfo.type === TransactionInfoType.SwapAndBridge;

/**
 * Type guard to check if a TransactionInfo is a SwapTransactionInfo.
 * @param txInfo - The transaction info to check.
 * @returns True if the transaction info is a SwapTransactionInfo.
 */
export const isSwapTransactionInfo = (
  txInfo: TransactionInfo,
): txInfo is SwapTransactionInfo => txInfo.type === TransactionInfoType.Swap;
