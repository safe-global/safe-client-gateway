import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';

export class AppPositionTokenInfo {
  @ApiProperty({
    description: 'Token contract address (0x0000000000000000000000000000000000000000 for native tokens)',
    example: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
  })
  address!: Address;

  @ApiProperty({
    description: 'Token decimals',
    example: 18,
  })
  decimals!: number;

  @ApiProperty({
    description: 'Token symbol',
    example: 'stETH',
  })
  symbol!: string;

  @ApiProperty({
    description: 'Token name',
    example: 'Staked Ether',
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
}

export class AppPosition {
  @ApiProperty({
    description: 'Unique position key',
    example: 'aave-v3-ethereum-steth',
  })
  key!: string;

  @ApiProperty({
    description: 'Position type (e.g., staked, lending, liquidity)',
    example: 'staked',
  })
  type!: string;

  @ApiProperty({
    description: 'Position name',
    example: 'Morpho Yield: cbBTC Pool (Gauntlet cbBTC Core)',
  })
  name!: string;

  @ApiProperty({
    description: 'Token information',
    type: AppPositionTokenInfo,
  })
  tokenInfo!: AppPositionTokenInfo;

  @ApiProperty({
    description: 'Position balance',
    example: '5000000000000000000',
  })
  balance!: string;

  @ApiPropertyOptional({
    type: 'string',
    description: 'Balance in requested fiat currency (decimal string)',
    example: '10000.00',
    nullable: true,
  })
  balanceFiat!: string | null;

  @ApiPropertyOptional({
    type: 'string',
    description: 'Price change percentage in the last 24 hours (decimal string)',
    example: '-4.31',
    nullable: true,
  })
  priceChangePercentage1d!: string | null;
}
