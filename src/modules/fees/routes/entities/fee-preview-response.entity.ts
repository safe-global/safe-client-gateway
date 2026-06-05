// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import { zeroAddress } from 'viem';
import { PriceSource } from '@/modules/fees/domain/entities/price-source.entity';
import type {
  RelayCost,
  TxFeesResponse,
} from '@/modules/fees/domain/entities/tx-fees-response.entity';

export class FeePreviewTxData {
  @ApiProperty({ description: 'Chain ID', example: '1' })
  chainId: string;

  @ApiProperty({ description: 'Safe address', example: '0x...' })
  safeAddress: Address;

  @ApiProperty({ description: 'Safe transaction gas', example: '150000' })
  safeTxGas: string;

  @ApiProperty({ description: 'Base gas for relay overhead', example: '48564' })
  baseGas: string;

  @ApiProperty({
    description:
      'Gas price per gas unit. Denominated in wei when `gasToken` is the native token (zero address), or in the ERC20 gas token atomic units per gas otherwise',
    example: '195000000000000',
  })
  gasPrice: string;

  @ApiProperty({ description: 'Gas token address', example: zeroAddress })
  gasToken: Address;

  @ApiProperty({
    description: 'Refund receiver address',
    example: zeroAddress,
  })
  refundReceiver: Address;

  @ApiProperty({ description: 'Number of signatures', example: 2 })
  numberSignatures: number;

  constructor(txData: TxFeesResponse['txData']) {
    this.chainId = txData.chainId;
    this.safeAddress = txData.safeAddress;
    this.safeTxGas = txData.safeTxGas;
    this.baseGas = txData.baseGas;
    this.gasPrice = txData.gasPrice;
    this.gasToken = txData.gasToken;
    this.refundReceiver = txData.refundReceiver;
    this.numberSignatures = txData.numberSignatures;
  }
}

export class FeePreviewPricingContext {
  @ApiProperty({ description: 'Pricing phase' })
  phase: number;

  @ApiProperty({
    enum: PriceSource,
    enumName: 'PriceSource',
    description: 'Price data source',
    example: PriceSource.COINGECKO,
  })
  priceSource: PriceSource;

  @ApiProperty({
    description: 'Price snapshot Unix timestamp',
    example: 1700000000,
  })
  priceTimestamp: number;

  @ApiProperty({
    description: 'Gas price volatility buffer multiplier',
    example: 1.3,
  })
  gasPriceVolatilityBuffer: number;

  constructor(pricingContext: TxFeesResponse['pricingContextSnapshot']) {
    this.phase = pricingContext.phase;
    this.priceSource = pricingContext.priceSource;
    this.priceTimestamp = pricingContext.priceTimestamp;
    this.gasPriceVolatilityBuffer = pricingContext.gasPriceVolatilityBuffer;
  }
}

export class FeePreviewRelayCost {
  @ApiProperty({ description: 'Fiat currency code', example: 'USD' })
  fiatCode: string;

  @ApiProperty({ description: 'Relay cost as a string', example: '0.0025' })
  fiatValue: string;

  constructor(relayCost: RelayCost) {
    this.fiatCode = relayCost.fiatCode;
    this.fiatValue = relayCost.fiatValue;
  }
}

export class FeePreviewResponse {
  @ApiProperty({ type: FeePreviewTxData })
  txData: FeePreviewTxData;

  @ApiProperty({ type: FeePreviewRelayCost })
  relayCost: FeePreviewRelayCost;

  @ApiProperty({ type: FeePreviewPricingContext })
  pricingContextSnapshot: FeePreviewPricingContext;

  constructor(txFeesResponse: TxFeesResponse) {
    this.txData = new FeePreviewTxData(txFeesResponse.txData);
    this.relayCost = new FeePreviewRelayCost(txFeesResponse.relayCost);
    this.pricingContextSnapshot = new FeePreviewPricingContext(
      txFeesResponse.pricingContextSnapshot,
    );
  }
}
