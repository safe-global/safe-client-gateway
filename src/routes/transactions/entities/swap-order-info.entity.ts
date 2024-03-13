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
  @ApiPropertyOptional({ type: String, nullable: true })
  logo: string | null;

  @ApiProperty()
  symbol: string;

  @ApiProperty()
  amount: string;

  constructor(args: { logo: string | null; symbol: string; amount: string }) {
    this.logo = args.logo;
    this.symbol = args.symbol;
    this.amount = args.amount;
  }
}

@ApiExtraModels(TokenInfo)
export abstract class SwapOrderTransactionInfo extends TransactionInfo {
  @ApiProperty()
  status: 'open' | 'fulfilled' | 'cancelled' | 'expired';

  @ApiProperty()
  orderKind: 'buy' | 'sell';

  @ApiProperty()
  sellToken: TokenInfo;

  @ApiProperty()
  buyToken: TokenInfo;

  @ApiProperty()
  expiresTimestamp: number;

  protected constructor(args: {
    status: 'open' | 'fulfilled' | 'cancelled' | 'expired';
    orderKind: 'buy' | 'sell';
    sellToken: TokenInfo;
    buyToken: TokenInfo;
    expiresTimestamp: number;
  }) {
    super(TransactionInfoType.SwapOrder, null, null);
    this.status = args.status;
    this.orderKind = args.orderKind;
    this.sellToken = args.sellToken;
    this.buyToken = args.buyToken;
    this.expiresTimestamp = args.expiresTimestamp;
  }
}

@ApiExtraModels(TokenInfo)
export class FulfilledSwapOrderTransactionInfo extends SwapOrderTransactionInfo {
  @ApiPropertyOptional({ type: String, nullable: true })
  surplus: string | null;

  @ApiProperty()
  executionPrice: string;

  constructor(args: {
    orderKind: 'buy' | 'sell';
    sellToken: TokenInfo;
    buyToken: TokenInfo;
    expiresTimestamp: number;
    surplus: string | null;
    executionPrice: string;
  }) {
    super({ ...args, status: 'fulfilled' });
    this.surplus = args.surplus;
    this.executionPrice = args.executionPrice;
  }
}

@ApiExtraModels(TokenInfo)
export class DefaultSwapOrderTransactionInfo extends SwapOrderTransactionInfo {
  @ApiProperty()
  limitPriceDescription: string;

  constructor(args: {
    status: 'open' | 'cancelled' | 'expired';
    orderKind: 'buy' | 'sell';
    sellToken: TokenInfo;
    buyToken: TokenInfo;
    expiresTimestamp: number;
    limitPriceDescription: string;
  }) {
    super({ ...args });
    this.limitPriceDescription = args.limitPriceDescription;
  }
}
