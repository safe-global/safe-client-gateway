import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { RichDecodedInfo } from '@/routes/transactions/entities/human-description.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { Transfer } from '@/routes/transactions/entities/transfers/transfer.entity';
import { SwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/swap-order-info.entity';
import {
  OrderStatus,
  OrderClass,
  OrderKind,
} from '@/domain/swaps/entities/order.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransferDirection,
  TransferTransactionInfo,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';

export class SwapTransferTransactionInfo
  extends TransactionInfo
  implements TransferTransactionInfo, SwapOrderTransactionInfo
{
  // TransferTransactionInfo properties
  @ApiProperty()
  sender: AddressInfo;

  @ApiProperty()
  recipient: AddressInfo;

  @ApiProperty()
  direction: TransferDirection;

  @ApiProperty()
  transferInfo: Transfer;

  // SwapOrderTransactionInfo properties
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

  constructor(args: {
    // TransferTransactionInfo properties
    sender: AddressInfo;
    recipient: AddressInfo;
    direction: TransferDirection;
    transferInfo: Transfer;
    humanDescription: string | null;
    richDecodedInfo: RichDecodedInfo | null | undefined;
    // SwapOrderTransactionInfo properties
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
    executedSurplusFee: string | null;
    receiver: string | null;
    owner: `0x${string}`;
    fullAppData: Record<string, unknown> | null;
  }) {
    // TransferTransactionInfo constructor
    super(
      TransactionInfoType.SwapTransfer,
      args.humanDescription,
      args.richDecodedInfo,
    );
    this.sender = args.sender;
    this.recipient = args.recipient;
    this.direction = args.direction;
    this.transferInfo = args.transferInfo;
    // SwapOrderTransactionInfo constructor
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
    this.executedSurplusFee = args.executedSurplusFee;
    this.receiver = args.receiver;
    this.owner = args.owner;
    this.fullAppData = args.fullAppData;
  }
}
