import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  OrderClass,
  OrderKind,
  OrderStatus,
} from '@/domain/swaps/entities/order.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';

export interface OrderInfo {
  uid: string;
  status: OrderStatus;
  kind: OrderKind;
  orderClass: OrderClass;
  validUntil: number;
  sellAmount: string;
  buyAmount: string;
  executedSellAmount: string;
  executedBuyAmount: string;
  explorerUrl: string;
  executedFee: string;
  executedFeeToken: TokenInfo;
  receiver: string | null;
  owner: `0x${string}`;
  fullAppData: Record<string, unknown> | null;
}

@ApiExtraModels(TokenInfo)
export class SwapOrderTransactionInfo
  extends TransactionInfo
  implements OrderInfo
{
  @ApiProperty({ enum: [TransactionInfoType.SwapOrder] })
  override type = TransactionInfoType.SwapOrder;

  @ApiProperty({ description: 'The order UID' })
  uid: string;

  @ApiProperty({
    enum: OrderStatus,
  })
  status: OrderStatus;

  @ApiProperty({ enum: Object.values(OrderKind) })
  kind: OrderKind;

  @ApiProperty({
    enum: OrderClass,
  })
  orderClass: OrderClass;

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
  explorerUrl: string;

  @ApiProperty({
    type: String,
    description: 'The amount of fees paid for this order.',
  })
  executedFee: string;

  @ApiProperty({
    type: String,
    description:
      'The token in which the fee was paid, expressed by SURPLUS tokens (BUY tokens for SELL orders and SELL tokens for BUY orders).',
  })
  executedFeeToken: TokenInfo;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'The (optional) address to receive the proceeds of the trade',
  })
  receiver: string | null;

  @ApiProperty({
    type: String,
  })
  owner: `0x${string}`;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'The App Data for this order',
  })
  fullAppData: Record<string, unknown> | null;

  constructor(args: {
    uid: string;
    orderStatus: OrderStatus;
    kind: OrderKind;
    class: OrderClass;
    validUntil: number;
    sellAmount: string;
    buyAmount: string;
    executedSellAmount: string;
    executedBuyAmount: string;
    sellToken: TokenInfo;
    buyToken: TokenInfo;
    explorerUrl: string;
    executedFee: string;
    executedFeeToken: TokenInfo;
    receiver: string | null;
    owner: `0x${string}`;
    fullAppData: Record<string, unknown> | null;
  }) {
    super(TransactionInfoType.SwapOrder, null);
    this.uid = args.uid;
    this.status = args.orderStatus;
    this.kind = args.kind;
    this.orderClass = args.class;
    this.validUntil = args.validUntil;
    this.sellAmount = args.sellAmount;
    this.buyAmount = args.buyAmount;
    this.executedSellAmount = args.executedSellAmount;
    this.executedBuyAmount = args.executedBuyAmount;
    this.sellToken = args.sellToken;
    this.buyToken = args.buyToken;
    this.explorerUrl = args.explorerUrl;
    this.executedFee = args.executedFee;
    this.executedFeeToken = args.executedFeeToken;
    this.receiver = args.receiver;
    this.owner = args.owner;
    this.fullAppData = args.fullAppData;
  }
}
