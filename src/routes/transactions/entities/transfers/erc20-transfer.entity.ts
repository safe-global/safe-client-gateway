import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transfer } from '@/routes/transactions/entities/transfers/transfer.entity';

export class Erc20Transfer extends Transfer {
  @ApiProperty()
  tokenAddress: string;
  @ApiProperty()
  value: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  tokenName: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  tokenSymbol: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUri: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  decimals: number | null;

  constructor(
    tokenAddress: string,
    value: string,
    tokenName: string | null = null,
    tokenSymbol: string | null = null,
    logoUri: string | null = null,
    decimals: number | null = null,
  ) {
    super('ERC20');
    this.tokenAddress = tokenAddress;
    this.value = value;
    this.tokenName = tokenName;
    this.tokenSymbol = tokenSymbol;
    this.logoUri = logoUri;
    this.decimals = decimals;
  }
}
