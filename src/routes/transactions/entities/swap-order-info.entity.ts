import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { OrderStatus } from '@/domain/swaps/entities/order.entity';

export class TokenInfo {
  @ApiProperty({ description: 'The token address' })
  address: `0x${string}`;

  @ApiProperty({ description: 'The token decimals' })
  decimals: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'The logo URI for the token',
  })
  logoUri: string | null;

  @ApiProperty({ description: 'The token name' })
  name: string;

  @ApiProperty({ description: 'The token symbol' })
  symbol: string;

  @ApiProperty({ description: 'The token trusted status' })
  trusted: boolean;

  constructor(args: {
    address: `0x${string}`;
    decimals: number;
    logoUri: string | null;
    name: string;
    symbol: string;
    trusted: boolean;
  }) {
    this.address = args.address;
    this.decimals = args.decimals;
    this.logoUri = args.logoUri;
    this.name = args.name;
    this.symbol = args.symbol;
    this.trusted = args.trusted;
  }
}

@ApiExtraModels(TokenInfo)
export class SwapOrderTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.SwapOrder] })
  override type = TransactionInfoType.SwapOrder;

  @ApiProperty({ description: 'The order UID' })
  uid: string;

  @ApiProperty({
    enum: OrderStatus,
  })
  status: OrderStatus;

  @ApiProperty({ enum: ['buy', 'sell'] })
  kind: 'buy' | 'sell';

  @ApiProperty({ description: 'The timestamp when the order expires' })
  validUntil: number;

  @ApiProperty({
    description: 'The sell token raw amount (no decimals)',
  })
  sellAmount: string;

  @ApiProperty({
    description: 'The buy token raw amount (no decimals)',
  })
  buyAmount: string;

  @ApiProperty({
    description: 'The executed sell token raw amount (no decimals)',
  })
  executedSellAmount: string;

  @ApiProperty({
    description: 'The executed buy token raw amount (no decimals)',
  })
  executedBuyAmount: string;

  @ApiProperty({ description: 'The sell token of the order' })
  sellToken: TokenInfo;

  @ApiProperty({ description: 'The buy token of the order' })
  buyToken: TokenInfo;

  @ApiProperty({
    type: String,
    description: 'The URL to the explorer page of the order',
  })
  explorerUrl: URL;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'The amount of fees paid for this order.',
  })
  executedSurplusFee: string | null;

  constructor(args: {
    uid: string;
    status: OrderStatus;
    kind: 'buy' | 'sell';
    validUntil: number;
    sellAmount: string;
    buyAmount: string;
    executedSellAmount: string;
    executedBuyAmount: string;
    sellToken: TokenInfo;
    buyToken: TokenInfo;
    explorerUrl: URL;
    executedSurplusFee: string | null;
  }) {
    super(TransactionInfoType.SwapOrder, null, null);
    this.uid = args.uid;
    this.status = args.status;
    this.kind = args.kind;
    this.validUntil = args.validUntil;
    this.sellAmount = args.sellAmount;
    this.buyAmount = args.buyAmount;
    this.executedSellAmount = args.executedSellAmount;
    this.executedBuyAmount = args.executedBuyAmount;
    this.sellToken = args.sellToken;
    this.buyToken = args.buyToken;
    this.explorerUrl = args.explorerUrl;
    this.executedSurplusFee = args.executedSurplusFee;
  }
}
