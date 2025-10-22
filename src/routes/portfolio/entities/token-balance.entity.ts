import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';

export class TokenBalanceTokenInfo {
  @ApiProperty({
    description: 'Token contract address (0x0000000000000000000000000000000000000000 for native tokens)',
    example: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  })
  address!: Address;

  @ApiProperty({
    description: 'Token decimals',
    example: 6,
  })
  decimals!: number;

  @ApiProperty({
    description: 'Token symbol',
    example: 'USDC',
  })
  symbol!: string;

  @ApiProperty({
    description: 'Token name',
    example: 'USD Coin',
  })
  name!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uri',
    description: 'Token logo URL (HTTPS)',
    example: 'https://example.com/logo.png',
    nullable: true,
  })
  logoUrl!: string | null;

  @ApiProperty({
    description: 'Chain ID where token is deployed',
    example: '1',
  })
  chainId!: string;

  @ApiProperty({
    description: 'Whether the token is verified by the provider',
    example: true,
  })
  trusted!: boolean;
}

export class TokenBalance {
  @ApiProperty({
    description: 'Token information',
    type: TokenBalanceTokenInfo,
  })
  tokenInfo!: TokenBalanceTokenInfo;

  @ApiProperty({
    description: 'Token balance (as string to avoid precision loss)',
    example: '1000000000',
  })
  balance!: string;

  @ApiPropertyOptional({
    type: 'number',
    description: 'Balance in requested fiat currency',
    example: 1000.50,
    nullable: true,
  })
  balanceFiat!: number | null;

  @ApiPropertyOptional({
    type: 'number',
    description: 'Token price in requested fiat currency',
    example: 4370.50,
    nullable: true,
  })
  price!: number | null;

  @ApiPropertyOptional({
    type: 'number',
    description: 'Price change as decimal (e.g., -0.0431 for -4.31%)',
    example: -0.0431,
    nullable: true,
  })
  priceChangePercentage1d!: number | null;
}
