import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class TokenInfo {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'The token logo',
  })
  logo: string | null;

  @ApiProperty({ description: 'The token symbol' })
  symbol: string;

  @ApiProperty({
    description: 'The token amount in decimal format',
  })
  amount: string;

  constructor(args: { logo: string | null; symbol: string; amount: string }) {
    this.logo = args.logo;
    this.symbol = args.symbol;
    this.amount = args.amount;
  }
}

@ApiExtraModels(TokenInfo)
export abstract class SwapOrderTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.SwapOrder] })
  override type: TransactionInfoType.SwapOrder;

  @ApiProperty({ description: 'The order UID' })
  orderUid: string;

  @ApiProperty({ enum: ['open', 'fulfilled', 'cancelled', 'expired'] })
  status: 'open' | 'fulfilled' | 'cancelled' | 'expired';

  @ApiProperty({ enum: ['buy', 'sell'] })
  orderKind: 'buy' | 'sell';

  @ApiProperty({ description: 'The sell token of the order' })
  sellToken: TokenInfo;

  @ApiProperty({ description: 'The buy token of the order' })
  buyToken: TokenInfo;

  @ApiProperty({ description: 'The timestamp when the order expires' })
  expiresTimestamp: number;

  @ApiProperty({
    description: 'The filled percentage of the order',
    examples: ['0.00', '50.75', '100.00'],
  })
  filledPercentage: string;

  @ApiProperty({ description: 'The URL to the explorer page of the order' })
  explorerUrl: URL;

  protected constructor(args: {
    orderUid: string;
    status: 'open' | 'fulfilled' | 'cancelled' | 'expired';
    orderKind: 'buy' | 'sell';
    sellToken: TokenInfo;
    buyToken: TokenInfo;
    expiresTimestamp: number;
    filledPercentage: string;
    explorerUrl: URL;
  }) {
    super(TransactionInfoType.SwapOrder, null, null);
    this.orderUid = args.orderUid;
    this.type = TransactionInfoType.SwapOrder;
    this.status = args.status;
    this.orderKind = args.orderKind;
    this.sellToken = args.sellToken;
    this.buyToken = args.buyToken;
    this.expiresTimestamp = args.expiresTimestamp;
    this.filledPercentage = args.filledPercentage;
    this.explorerUrl = args.explorerUrl;
  }
}

@ApiExtraModels(TokenInfo)
export class FulfilledSwapOrderTransactionInfo extends SwapOrderTransactionInfo {
  @ApiProperty({ enum: ['fulfilled'] })
  override status: 'fulfilled';

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'The amount of fees paid for this order in the format of "$feeAmount $tokenSymbol"',
  })
  feeLabel: string | null;

  @ApiProperty({
    description:
      'The execution price label is in the format of "1 $sellTokenSymbol = $ratio $buyTokenSymbol"',
  })
  executionPriceLabel: string;

  @ApiProperty({
    description:
      'The (averaged) surplus for this order in the format of "$surplusAmount $tokenSymbol"',
  })
  surplusLabel: string;

  constructor(args: {
    orderUid: string;
    orderKind: 'buy' | 'sell';
    sellToken: TokenInfo;
    buyToken: TokenInfo;
    expiresTimestamp: number;
    feeLabel: string | null;
    executionPriceLabel: string;
    surplusLabel: string;
    filledPercentage: string;
    explorerUrl: URL;
  }) {
    super({ ...args, status: 'fulfilled' });
    this.status = 'fulfilled';
    this.feeLabel = args.feeLabel;
    this.executionPriceLabel = args.executionPriceLabel;
    this.surplusLabel = args.surplusLabel;
  }
}

@ApiExtraModels(TokenInfo)
export class DefaultSwapOrderTransactionInfo extends SwapOrderTransactionInfo {
  @ApiProperty({ enum: ['open', 'cancelled', 'expired'] })
  override status: 'open' | 'cancelled' | 'expired';

  @ApiProperty({
    description:
      'The limit price label is in the format of "1 $sellTokenSymbol = $limitPriceLabel $buyTokenSymbol"',
  })
  limitPriceLabel: string;

  constructor(args: {
    orderUid: string;
    status: 'open' | 'cancelled' | 'expired';
    orderKind: 'buy' | 'sell';
    sellToken: TokenInfo;
    buyToken: TokenInfo;
    expiresTimestamp: number;
    limitPriceLabel: string;
    filledPercentage: string;
    explorerUrl: URL;
  }) {
    super(args);
    this.status = args.status;
    this.limitPriceLabel = args.limitPriceLabel;
  }
}
