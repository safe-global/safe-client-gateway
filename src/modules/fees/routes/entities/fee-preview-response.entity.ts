// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import { zeroAddress } from 'viem';
import type {
  GtfFeeBreakdown,
  GtfFeesResponse,
} from '@/modules/fees/domain/entities/gtf-fees-response.entity';
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

  constructor(txData: {
    chainId: string;
    safeAddress: Address;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: Address;
    refundReceiver: Address;
    numberSignatures: number;
  }) {
    this.chainId = txData.chainId;
    this.safeAddress = txData.safeAddress;
    this.safeTxGas = txData.safeTxGas;
    this.baseGas = txData.baseGas;
    this.gasPrice = txData.gasPrice;
    this.gasToken = txData.gasToken;
    this.refundReceiver = txData.refundReceiver;
    this.numberSignatures = txData.numberSignatures;
  }

  static fromGtfFees(
    txData: GtfFeesResponse['txData'],
    numberSignatures: number,
  ): FeePreviewTxData {
    return new FeePreviewTxData({
      chainId: txData.chainId,
      safeAddress: txData.safeAddress,
      safeTxGas: txData.safeTxGas,
      baseGas: txData.baseGas,
      gasPrice: txData.gasPrice,
      gasToken: txData.gasToken,
      refundReceiver: txData.refundReceiver,
      numberSignatures,
    });
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

export class FeePreviewValuationDetail {
  @ApiPropertyOptional({
    description: 'Token contract address (absent for native transfers)',
  })
  tokenAddress?: Address;

  @ApiProperty({ description: 'Token symbol', example: 'USDC' })
  symbol: string;

  @ApiProperty({ description: 'Token amount', example: '1000' })
  amount: string;

  @ApiPropertyOptional({ description: 'Token price in USD' })
  priceUsd?: number;

  @ApiPropertyOptional({ description: 'Token value in USD' })
  valueUsd?: number;

  constructor(detail: GtfFeeBreakdown['valuationDetails'][number]) {
    this.tokenAddress = detail.tokenAddress;
    this.symbol = detail.symbol;
    this.amount = detail.amount;
    this.priceUsd = detail.priceUsd;
    this.valueUsd = detail.valueUsd;
  }
}

export class FeePreviewFeeBreakdown {
  @ApiProperty({ description: 'Transaction value in USD', example: 1000 })
  txValueUsd: number;

  @ApiProperty({
    description: 'Trailing volume in USD that fed tier selection',
    example: 0,
  })
  trailingVolumeUsd: number;

  @ApiProperty({ description: 'Tier fee in basis points', example: 5 })
  tierBps: number;

  @ApiProperty({ description: 'GTF fee in USD', example: 0.5 })
  gtfFeeUsd: number;

  @ApiProperty({ description: 'Relay cost in USD', example: 38.22 })
  relayCostUsd: number;

  @ApiProperty({ description: 'Total fee in USD', example: 38.72 })
  totalUsd: number;

  @ApiProperty({ description: 'Number of signatures', example: 2 })
  numberSignatures: number;

  @ApiProperty({ type: [FeePreviewValuationDetail] })
  valuationDetails: Array<FeePreviewValuationDetail>;

  constructor(feeBreakdown: GtfFeeBreakdown) {
    this.txValueUsd = feeBreakdown.txValueUsd;
    this.trailingVolumeUsd = feeBreakdown.trailingVolumeUsd;
    this.tierBps = feeBreakdown.tierBps;
    this.gtfFeeUsd = feeBreakdown.gtfFeeUsd;
    this.relayCostUsd = feeBreakdown.relayCostUsd;
    this.totalUsd = feeBreakdown.totalUsd;
    this.numberSignatures = feeBreakdown.numberSignatures;
    this.valuationDetails = feeBreakdown.valuationDetails.map(
      (detail) => new FeePreviewValuationDetail(detail),
    );
  }
}

export class FeePreviewResponse {
  @ApiProperty({ type: FeePreviewTxData })
  txData: FeePreviewTxData;

  @ApiPropertyOptional({
    type: FeePreviewRelayCost,
    description: 'Relay cost. Present when the relay fee flow applies.',
  })
  relayCost?: FeePreviewRelayCost;

  @ApiPropertyOptional({
    type: FeePreviewFeeBreakdown,
    description:
      'GTF fee breakdown, as returned by the fee-engine service. Present when the GTF fee flow applies.',
  })
  feeBreakdown?: FeePreviewFeeBreakdown;

  @ApiPropertyOptional({
    description:
      'Maximum fee cap in USD (buffered max fee). Present when the GTF fee flow applies.',
  })
  maxFeeCapUsd?: number;

  private constructor(args: {
    txData: FeePreviewTxData;
    relayCost?: FeePreviewRelayCost;
    feeBreakdown?: FeePreviewFeeBreakdown;
    maxFeeCapUsd?: number;
  }) {
    this.txData = args.txData;
    this.relayCost = args.relayCost;
    this.feeBreakdown = args.feeBreakdown;
    this.maxFeeCapUsd = args.maxFeeCapUsd;
  }

  static fromRelayFees(txFeesResponse: TxFeesResponse): FeePreviewResponse {
    return new FeePreviewResponse({
      txData: new FeePreviewTxData(txFeesResponse.txData),
      relayCost: new FeePreviewRelayCost(txFeesResponse.relayCost),
    });
  }

  static fromGtfFees(gtfFeesResponse: GtfFeesResponse): FeePreviewResponse {
    return new FeePreviewResponse({
      txData: FeePreviewTxData.fromGtfFees(
        gtfFeesResponse.txData,
        gtfFeesResponse.feeBreakdown.numberSignatures,
      ),
      feeBreakdown: new FeePreviewFeeBreakdown(gtfFeesResponse.feeBreakdown),
      maxFeeCapUsd: gtfFeesResponse.pricingContextSnapshot.maxFeeCapUsd,
    });
  }
}
