import {
  BridgeStatus,
  StatusMessages,
} from '@/domain/bridge/entities/bridge-status.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// TODO: Create common interface and align properties with existing decoding, e.g. buyToken, sellToken

export class BridgeTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: TransactionInfoType })
  type = TransactionInfoType.Bridge;

  constructor() {
    super(TransactionInfoType.Bridge, null);
  }
}

export class SwapTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: TransactionInfoType })
  type = TransactionInfoType.Swap;

  constructor() {
    super(TransactionInfoType.Swap, null);
  }
}

export class SwapAndBridgeTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: TransactionInfoType })
  type = TransactionInfoType.SwapAndBridge;

  @ApiProperty()
  fromToken: TokenInfo;

  @ApiProperty()
  toToken: TokenInfo;

  @ApiProperty()
  recipient: AddressInfo;

  @ApiProperty()
  exchangeRate: number;

  @ApiPropertyOptional()
  explorerUrl: string | null;

  @ApiProperty({ enum: [...StatusMessages, 'UNKNOWN'] })
  status: BridgeStatus['status'];

  @ApiProperty()
  numberOfSteps: number;

  @ApiProperty()
  fee: number;

  @ApiProperty()
  fromAmount: string;

  @ApiProperty()
  toAmount: string;

  constructor(args: {
    fromToken: TokenInfo;
    toToken: TokenInfo;
    recipient: AddressInfo;
    exchangeRate: number;
    explorerUrl: string | null;
    status: BridgeStatus['status'];
    numberOfSteps: number;
    fee: number;
    fromAmount: string;
    toAmount: string;
  }) {
    super(TransactionInfoType.SwapAndBridge, null);

    this.fromToken = args.fromToken;
    this.toToken = args.toToken;
    this.recipient = args.recipient;
    this.exchangeRate = args.exchangeRate;
    this.explorerUrl = args.explorerUrl;
    this.status = args.status;
    this.numberOfSteps = args.numberOfSteps;
    this.fee = args.fee;
    this.fromAmount = args.fromAmount;
    this.toAmount = args.toAmount;
  }
}
