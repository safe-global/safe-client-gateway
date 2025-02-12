import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
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
import { Erc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { Erc721Transfer } from '@/routes/transactions/entities/transfers/erc721-transfer.entity';
import { NativeCoinTransfer } from '@/routes/transactions/entities/transfers/native-coin-transfer.entity';

export class SwapTransferTransactionInfo
  extends TransactionInfo
  implements TransferTransactionInfo, SwapOrderTransactionInfo
{
  @ApiProperty({ enum: [TransactionInfoType.SwapTransfer] })
  override type = TransactionInfoType.SwapTransfer;

  // TransferTransactionInfo properties
  @ApiProperty()
  sender: AddressInfo;

  @ApiProperty()
  recipient: AddressInfo;

  @ApiProperty()
  direction: TransferDirection;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(Erc20Transfer) },
      { $ref: getSchemaPath(Erc721Transfer) },
      { $ref: getSchemaPath(NativeCoinTransfer) },
    ],
  })
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

  @ApiProperty({
    type: String,
    description: 'The amount of fees paid for this order.',
  })
  executedFee: string;

  @ApiProperty({
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
    // TransferTransactionInfo properties
    sender: AddressInfo;
    recipient: AddressInfo;
    direction: TransferDirection;
    transferInfo: Transfer;
    humanDescription: string | null;
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
    executedFee: string;
    executedFeeToken: TokenInfo;
    receiver: string | null;
    owner: `0x${string}`;
    fullAppData: Record<string, unknown> | null;
  }) {
    // TransferTransactionInfo constructor
    super(TransactionInfoType.SwapTransfer, args.humanDescription);
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
    this.executedFee = args.executedFee;
    this.executedFeeToken = args.executedFeeToken;
    this.receiver = args.receiver;
    this.owner = args.owner;
    this.fullAppData = args.fullAppData;
  }
}

export function isSwapTransferTransactionInfo(
  txInfo: TransactionInfo,
): txInfo is SwapTransferTransactionInfo {
  return txInfo.type === TransactionInfoType.SwapTransfer;
}
