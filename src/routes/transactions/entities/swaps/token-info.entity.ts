import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
