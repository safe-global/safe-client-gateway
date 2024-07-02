import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import { OrderInfo } from '@/routes/transactions/entities/swaps/swap-order-info.entity';
import {
  OrderClass,
  OrderKind,
  OrderStatus,
} from '@/domain/swaps/entities/order.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  DurationOfPart,
  StartTime,
  TwapOrderInfo,
} from '@/routes/transactions/entities/swaps/twap-order-info.entity';

interface Baseline {
  method: string;
  parameters: DataDecodedParameter[] | null;
}

enum DecodedType {
  Generic = 'GENERIC',
  CowSwapOrder = 'COW_SWAP_ORDER',
  CowSwapTwapOrder = 'COW_SWAP_TWAP_ORDER',
}

export type ConfirmationView =
  | BaselineConfirmationView
  | CowSwapConfirmationView
  | CowSwapTwapConfirmationView;

export class BaselineConfirmationView implements Baseline {
  @ApiProperty({ enum: [DecodedType.Generic] })
  type = DecodedType.Generic;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
  }
}

export class CowSwapConfirmationView implements Baseline, OrderInfo {
  // Baseline implementation
  @ApiProperty({ enum: [DecodedType.CowSwapOrder] })
  type = DecodedType.CowSwapOrder;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  // OrderInfo implementation
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

  @ApiProperty({
    type: String,
    description: 'The URL to the explorer page of the order',
  })
  explorerUrl: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'The amount of fees paid for this order.',
  })
  executedSurplusFee: string | null;

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

  @ApiProperty({ description: 'The sell token of the order' })
  sellToken: TokenInfo;

  @ApiProperty({ description: 'The buy token of the order' })
  buyToken: TokenInfo;

  constructor(
    args: Baseline & OrderInfo & { sellToken: TokenInfo; buyToken: TokenInfo },
  ) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.uid = args.uid;
    this.status = args.status;
    this.kind = args.kind;
    this.orderClass = args.orderClass;
    this.validUntil = args.validUntil;
    this.sellAmount = args.sellAmount;
    this.buyAmount = args.buyAmount;
    this.executedSellAmount = args.executedSellAmount;
    this.executedBuyAmount = args.executedBuyAmount;
    this.explorerUrl = args.explorerUrl;
    this.executedSurplusFee = args.executedSurplusFee;
    this.sellToken = args.sellToken;
    this.buyToken = args.buyToken;
    this.receiver = args.receiver;
    this.owner = args.owner;
    this.fullAppData = args.fullAppData;
  }
}

export class CowSwapTwapConfirmationView implements Baseline, TwapOrderInfo {
  // Baseline implementation
  @ApiProperty({ enum: [DecodedType.CowSwapTwapOrder] })
  type = DecodedType.CowSwapTwapOrder;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  // TwapOrderInfo implementation
  @ApiProperty({
    enum: OrderStatus,
    description: 'The TWAP status',
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
      'The executed surplus fee raw amount (no decimals), or null if there are too many parts',
  })
  executedSurplusFee: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The executed buy token raw amount (no decimals), or null if there are too many parts',
  })
  executedBuyAmount: string | null;

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
    method: string;
    parameters: DataDecodedParameter[] | null;
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
    this.method = args.method;
    this.parameters = args.parameters;
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
