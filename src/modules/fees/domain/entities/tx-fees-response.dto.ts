// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { zeroAddress } from 'viem';
import type { Address } from 'viem';

export enum PriceSource {
  COINGECKO = 'COINGECKO',
}

export class TxDataResponse {
  @ApiProperty({ description: 'Chain ID', example: 1 })
  chainId!: number;

  @ApiProperty({ description: 'Safe address', example: '0x...' })
  safeAddress!: Address;

  @ApiProperty({ description: 'Safe transaction gas', example: '150000' })
  safeTxGas!: string;

  @ApiProperty({ description: 'Base gas for relay overhead', example: '48564' })
  baseGas!: string;

  @ApiProperty({
    description:
      'Gas price per gas unit. Denominated in wei when `gasToken` is the native token (zero address), or in the ERC20 gas token atomic units per gas otherwise',
    example: '195000000000000',
  })
  gasPrice!: string;

  @ApiProperty({
    description: 'Gas token address',
    example: zeroAddress,
  })
  gasToken!: Address;

  @ApiProperty({
    description: 'Refund receiver address',
    example: zeroAddress,
  })
  refundReceiver!: Address;

  @ApiProperty({ description: 'Number of signatures', example: 2 })
  numberSignatures!: number;
}

export class PricingContextSnapshot {
  @ApiProperty({ description: 'Pricing phase' })
  phase!: number;

  @ApiProperty({
    enum: PriceSource,
    enumName: 'PriceSource',
    description: 'Price data source',
    example: PriceSource.COINGECKO,
  })
  priceSource!: PriceSource;

  @ApiProperty({
    description: 'Price snapshot Unix timestamp',
    example: 1700000000,
  })
  priceTimestamp!: number;

  @ApiProperty({
    description: 'Gas volatility buffer multiplier',
    example: 1.3,
  })
  gasVolatilityBuffer!: number;
}

export class TxFeesResponse {
  @ApiProperty({ type: TxDataResponse })
  txData!: TxDataResponse;

  @ApiProperty({ description: 'Relay cost in USD', example: 38.22 })
  relayCostUsd!: number;

  @ApiProperty({ type: PricingContextSnapshot })
  pricingContextSnapshot!: PricingContextSnapshot;
}
