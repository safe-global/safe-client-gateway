import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { TransactionInfo } from './multisig-transaction.entity';

export enum TransferDirection {
  Incoming,
  Outgoing,
  Unknown,
}

export class Erc20TransferInfo {
  @ApiProperty()
  tokenAddress: string;
  @ApiPropertyOptional()
  tokenName?: string;
  @ApiPropertyOptional()
  tokenSymbol?: string;
  @ApiPropertyOptional()
  logoUri?: string;
  @ApiPropertyOptional()
  decimals?: number;
  @ApiProperty()
  value: string;
}

export class Erc721TransferInfo {
  @ApiProperty()
  tokenAddress: string;
  @ApiProperty()
  tokenId: string;
  @ApiPropertyOptional()
  tokenName?: string;
  @ApiPropertyOptional()
  tokenSymbol?: string;
  @ApiPropertyOptional()
  logoUri?: string;
}

export class NativeCoinTransferInfo {
  @ApiProperty()
  value: string;
}

export class TransferTransaction extends TransactionInfo {
  @ApiProperty()
  sender: AddressInfo;
  @ApiProperty()
  recipient: AddressInfo;
  @ApiProperty()
  direction: string;
  @ApiProperty()
  transferInfo: Erc20TransferInfo | Erc721TransferInfo | NativeCoinTransferInfo;
}
