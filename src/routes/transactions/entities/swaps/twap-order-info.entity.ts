import {
  OrderStatus,
  OrderKind,
  OrderClass,
} from '@/domain/swaps/entities/order.entity';
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

export enum DurationType {
  Auto = 'AUTO',
  LimitDuration = 'LIMIT_DURATION',
}

export enum StartTimeValue {
  AtMiningTime = 'AT_MINING_TIME',
  AtEpoch = 'AT_EPOCH',
}

export type DurationOfPart =
  | { durationType: DurationType.Auto }
  | { durationType: DurationType.LimitDuration; duration: string };

export type StartTime =
  | { startType: StartTimeValue.AtMiningTime }
  | { startType: StartTimeValue.AtEpoch; epoch: number };

export type TwapOrderInfo = {
  status: OrderStatus;
  kind: OrderKind.Sell;
  class: OrderClass.Limit;
  validUntil: number;
  sellAmount: string;
  buyAmount: string;
  executedSellAmount: string | null;
  executedBuyAmount: string | null;
  executedSurplusFee: string | null;
  sellToken: TokenInfo;
  buyToken: TokenInfo;
  receiver: `0x${string}`;
  owner: `0x${string}`;
  numberOfParts: string;
  partSellAmount: string;
  minPartLimit: string;
  timeBetweenParts: number;
  durationOfPart: DurationOfPart;
  startTime: StartTime;
};

@ApiExtraModels(TokenInfo)
export class TwapOrderTransactionInfo
  extends TransactionInfo
  implements TwapOrderInfo
{
  @ApiProperty({ enum: [TransactionInfoType.TwapOrder] })
  override type = TransactionInfoType.TwapOrder;

  @ApiProperty({
    description: 'The TWAP status',
    enum: OrderStatus,
  })
  status: OrderStatus;

  @ApiProperty({ enum: OrderKind })
  kind: OrderKind.Sell;

  @ApiProperty({ enum: OrderClass })
  class: OrderClass.Limit;

  @ApiProperty({ description: 'The timestamp when the TWAP expires' })
  validUntil: number;

  @ApiProperty({
    description: 'The sell token raw amount (no decimals)',
  })
  sellAmount: string;

  @ApiProperty({
    description: 'The buy token raw amount (no decimals)',
  })
  buyAmount: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The executed sell token raw amount (no decimals), or null if there are too many parts',
  })
  executedSellAmount: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The executed buy token raw amount (no decimals), or null if there are too many parts',
  })
  executedBuyAmount: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The executed surplus fee raw amount (no decimals), or null if there are too many parts',
  })
  executedSurplusFee: string | null;

  @ApiProperty({ description: 'The sell token of the TWAP' })
  sellToken: TokenInfo;

  @ApiProperty({ description: 'The buy token of the TWAP' })
  buyToken: TokenInfo;

  @ApiProperty({
    description: 'The address to receive the proceeds of the trade',
  })
  receiver: `0x${string}`;

  @ApiProperty({
    type: String,
  })
  owner: `0x${string}`;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'The App Data for this TWAP',
  })
  fullAppData: Record<string, unknown> | null;

  @ApiProperty({
    description: 'The number of parts in the TWAP',
  })
  numberOfParts: string;

  @ApiProperty({
    description: 'The amount of sellToken to sell in each part',
  })
  partSellAmount: string;

  @ApiProperty({
    description: 'The amount of buyToken that must be bought in each part',
  })
  minPartLimit: string;

  @ApiProperty({
    description: 'The duration of the TWAP interval',
  })
  timeBetweenParts: number;

  @ApiProperty({
    description: 'Whether the TWAP is valid for the entire interval or not',
  })
  durationOfPart: DurationOfPart;

  @ApiProperty({
    description: 'The start time of the TWAP',
  })
  startTime: StartTime;

  constructor(args: {
    status: OrderStatus;
    kind: OrderKind.Sell;
    class: OrderClass.Limit;
    validUntil: number;
    sellAmount: string;
    buyAmount: string;
    executedSellAmount: string | null;
    executedBuyAmount: string | null;
    executedSurplusFee: string | null;
    sellToken: TokenInfo;
    buyToken: TokenInfo;
    receiver: `0x${string}`;
    owner: `0x${string}`;
    fullAppData: Record<string, unknown> | null;
    numberOfParts: string;
    partSellAmount: string;
    minPartLimit: string;
    timeBetweenParts: number;
    durationOfPart: DurationOfPart;
    startTime: StartTime;
  }) {
    super(TransactionInfoType.SwapOrder, null, null);
    this.status = args.status;
    this.kind = args.kind;
    this.class = args.class;
    this.validUntil = args.validUntil;
    this.sellAmount = args.sellAmount;
    this.buyAmount = args.buyAmount;
    this.executedSellAmount = args.executedSellAmount;
    this.executedBuyAmount = args.executedBuyAmount;
    this.executedSurplusFee = args.executedSurplusFee;
    this.sellToken = args.sellToken;
    this.buyToken = args.buyToken;
    this.receiver = args.receiver;
    this.owner = args.owner;
    this.fullAppData = args.fullAppData;
    this.numberOfParts = args.numberOfParts;
    this.partSellAmount = args.partSellAmount;
    this.minPartLimit = args.minPartLimit;
    this.timeBetweenParts = args.timeBetweenParts;
    this.durationOfPart = args.durationOfPart;
    this.startTime = args.startTime;
  }
}
