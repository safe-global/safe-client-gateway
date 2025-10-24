import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';

export class TokenBalanceTokenInfo {
  @ApiProperty({
    description: 'Token contract address (0x0000000000000000000000000000000000000000 for native tokens)',
  })
  address!: Address;

  @ApiProperty({
    description: 'Token decimals',
  })
  decimals!: number;

  @ApiProperty({
    description: 'Token symbol',
  })
  symbol!: string;

  @ApiProperty({
    description: 'Token name',
  })
  name!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uri',
    description: 'Token logo URL (HTTPS)',
    nullable: true,
  })
  logoUrl!: string | null;

  @ApiProperty({
    description: 'Chain ID where token is deployed',
  })
  chainId!: string;

  @ApiProperty({
    description: 'Whether the token is verified by the provider',
  })
  trusted!: boolean;

  @ApiProperty({
    description: 'Unique asset identifier (human-readable slug like "eth", "dai", "weth-c02a")',
    example: 'eth',
  })
  assetId!: string;
}

export class TokenBalance {
  @ApiProperty({
    description: 'Token information',
    type: TokenBalanceTokenInfo,
  })
  tokenInfo!: TokenBalanceTokenInfo;

  @ApiProperty({
    description: 'Token balance (as string to avoid precision loss)',
  })
  balance!: string;

  @ApiPropertyOptional({
    type: 'number',
    description: 'Balance in requested fiat currency',
    nullable: true,
  })
  balanceFiat!: number | null;

  @ApiPropertyOptional({
    type: 'number',
    description: 'Token price in requested fiat currency',
    nullable: true,
  })
  price!: number | null;

  @ApiPropertyOptional({
    type: 'number',
    description: 'Price change as decimal (e.g., -0.0431 for -4.31%)',
    nullable: true,
  })
  priceChangePercentage1d!: number | null;
}
