// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import { zeroAddress } from 'viem';
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

  private constructor(args: {
    txData: FeePreviewTxData;
    relayCost: FeePreviewRelayCost;
  }) {
    this.txData = args.txData;
    this.relayCost = args.relayCost;
  }

  static fromRelayFees(txFeesResponse: TxFeesResponse): FeePreviewResponse {
    return new FeePreviewResponse({
      txData: new FeePreviewTxData(txFeesResponse.txData),
      relayCost: new FeePreviewRelayCost(txFeesResponse.relayCost),
    });
  }
}
