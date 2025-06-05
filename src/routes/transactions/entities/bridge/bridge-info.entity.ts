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
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

// TODO: Create common interface and align properties with existing decoding, e.g. buyToken, sellToken
export class SwapTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.Swap] })
  override type = TransactionInfoType.Swap;

  constructor() {
    super(TransactionInfoType.Swap, null);
  }
}

@ApiExtraModels(BridgeFee)
export class BridgeAndSwapTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.SwapAndBridge] })
  override type = TransactionInfoType.SwapAndBridge;

  @ApiProperty()
  fromToken: TokenInfo;

  @ApiProperty()
  recipient: AddressInfo;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
  toToken?: TokenInfo;

  @ApiPropertyOptional()
  toAmount?: string;

  constructor(args: {
    fromToken: TokenInfo;
    fromAmount: string;
    recipient: AddressInfo;
    explorerUrl: string | null;
    status: BridgeStatus['status'] | 'AWAITING_EXECUTION';
    substatus: BridgeStatus['substatus'] | 'AWAITING_EXECUTION';
    fees: {
      tokenAddress: `0x${string}`;
      integratorFee: string;
      lifiFee: string;
    } | null;
    toChain: string;
    toToken?: TokenInfo;
    toAmount?: string;
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
