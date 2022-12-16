import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transfer } from './transfer.entity';

export class Erc721Transfer extends Transfer {
  @ApiProperty()
  tokenAddress: string;
  @ApiProperty()
  tokenId: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  tokenName: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  tokenSymbol: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUri: string | null;

  constructor(
    tokenAddress: string,
    tokenId: string,
    tokenName: string | null = null,
    tokenSymbol: string | null = null,
    logoUri: string | null = null,
  ) {
    super('ERC721');
    this.tokenAddress = tokenAddress;
    this.tokenId = tokenId;
    this.tokenName = tokenName;
    this.tokenSymbol = tokenSymbol;
    this.logoUri = logoUri;
  }
}
