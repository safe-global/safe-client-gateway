// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  GtfFeeBreakdown,
  GtfFeesResponse,
  GtfPricingContextSnapshot,
  GtfTxData,
  GtfValuationDetail,
} from '@/modules/fees/domain/entities/gtf-fees-response.entity';
import { Origin } from '@/modules/fees/domain/entities/origin.entity';
import { PriceSource } from '@/modules/fees/domain/entities/price-source.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

export function gtfTxDataBuilder(): IBuilder<GtfTxData> {
  return new Builder<GtfTxData>()
    .with('chainId', faker.number.int({ min: 1, max: 99999 }).toString())
    .with('safeAddress', getAddress(faker.finance.ethereumAddress()))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', '0')
    .with(
      'data',
      faker.string.hexadecimal({
        casing: 'lower',
        prefix: '0x',
      }) as `0x${string}`,
    )
    .with('operation', Operation.CALL)
    .with('safeTxGas', faker.string.numeric({ length: 6 }))
    .with('baseGas', faker.string.numeric({ length: 5 }))
    .with('gasPrice', faker.string.numeric({ length: 15 }))
    .with('gasToken', getAddress(zeroAddress))
    .with('refundReceiver', getAddress(zeroAddress))
    .with('nonce', faker.number.int({ min: 0, max: 999 }).toString());
}

export function gtfValuationDetailBuilder(): IBuilder<GtfValuationDetail> {
  return new Builder<GtfValuationDetail>()
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('symbol', faker.finance.currencySymbol())
    .with('amount', faker.string.numeric({ length: 6 }))
    .with('priceUsd', faker.number.float({ min: 0, max: 100 }))
    .with('valueUsd', faker.number.float({ min: 0, max: 1000 }));
}

export function gtfFeeBreakdownBuilder(): IBuilder<GtfFeeBreakdown> {
  return new Builder<GtfFeeBreakdown>()
    .with('txValueUsd', faker.number.float({ min: 0, max: 1000 }))
    .with('trailingVolumeUsd', faker.number.float({ min: 0, max: 1000 }))
    .with('tierBps', faker.number.int({ min: 0, max: 100 }))
    .with('gtfFeeUsd', faker.number.float({ min: 0, max: 100 }))
    .with('relayCostUsd', faker.number.float({ min: 0, max: 100 }))
    .with('totalUsd', faker.number.float({ min: 0, max: 1000 }))
    .with('numberSignatures', faker.number.int({ min: 1, max: 10 }))
    .with('valuationDetails', [gtfValuationDetailBuilder().build()]);
}

export function gtfPricingContextSnapshotBuilder(): IBuilder<GtfPricingContextSnapshot> {
  return new Builder<GtfPricingContextSnapshot>()
    .with('priceSource', PriceSource.COINGECKO)
    .with('priceTimestamp', faker.number.int())
    .with('gasPriceVolatilityBuffer', faker.number.float({ min: 1, max: 2 }))
    .with('tierBps', faker.number.int({ min: 0, max: 100 }))
    .with('origin', faker.helpers.enumValue(Origin))
    .with('maxFeeCapUsd', faker.number.float({ min: 0, max: 1000 }));
}

export function gtfFeesResponseBuilder(): IBuilder<GtfFeesResponse> {
  return new Builder<GtfFeesResponse>()
    .with(
      'safeTxHash',
      faker.string.hexadecimal({
        casing: 'lower',
        prefix: '0x',
        length: 64,
      }) as `0x${string}`,
    )
    .with('txData', gtfTxDataBuilder().build())
    .with('feeBreakdown', gtfFeeBreakdownBuilder().build())
    .with('pricingContextSnapshot', gtfPricingContextSnapshotBuilder().build());
}
