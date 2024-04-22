import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import { OrderInfo } from '@/routes/transactions/entities/swaps/swap-order-info.entity';
import { OrderClass, OrderStatus } from '@/domain/swaps/entities/order.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';

interface Baseline {
  method: string;
  parameters: DataDecodedParameter[] | null;
}

enum DecodedType {
  Generic = 'GENERIC',
  CowSwapOrder = 'COW_SWAP_ORDER',
}

export type ConfirmationView =
  | BaselineConfirmationView
  | CowSwapConfirmationView;

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
  orderStatus: OrderStatus;

  @ApiProperty({ enum: ['buy', 'sell'] })
  kind: 'buy' | 'sell';

  @ApiProperty({
    enum: OrderClass,
  })
  class: OrderClass;

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
  explorerUrl: URL;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'The amount of fees paid for this order.',
  })
  executedSurplusFee: string | null;

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
    this.orderStatus = args.orderStatus;
    this.kind = args.kind;
    this.class = args.class;
    this.validUntil = args.validUntil;
    this.sellAmount = args.sellAmount;
    this.buyAmount = args.buyAmount;
    this.executedSellAmount = args.executedSellAmount;
    this.executedBuyAmount = args.executedBuyAmount;
    this.explorerUrl = args.explorerUrl;
    this.executedSurplusFee = args.executedSurplusFee;
    this.sellToken = args.sellToken;
    this.buyToken = args.buyToken;
  }
}
