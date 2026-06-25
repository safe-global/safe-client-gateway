// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { PriceSource } from '@/modules/fees/domain/entities/price-source.entity';
import type {
  GtfFee,
  GtfFeesResponse,
  GtfPricingContextSnapshot,
  GtfTxData,
} from '@/modules/fees/domain/entities/gtf-fees-response.entity';

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
    .with('numberSignatures', faker.number.int({ min: 1, max: 10 }))
    .with('nonce', faker.number.int({ min: 0, max: 999 }).toString());
}

export function gtfFeeBuilder(): IBuilder<GtfFee> {
  return new Builder<GtfFee>()
    .with('fiatCode', faker.finance.currencyCode())
    .with('fiatValue', faker.number.float({ min: 0, max: 100 }).toString())
    .with('tier', 'STANDARD');
}

export function gtfPricingContextSnapshotBuilder(): IBuilder<GtfPricingContextSnapshot> {
  return new Builder<GtfPricingContextSnapshot>()
    .with('priceSource', PriceSource.COINGECKO)
    .with('priceTimestamp', faker.number.int())
    .with('gasPriceVolatilityBuffer', faker.number.float({ min: 1, max: 2 }));
}

export function gtfFeesResponseBuilder(): IBuilder<GtfFeesResponse> {
  return new Builder<GtfFeesResponse>()
    .with('txData', gtfTxDataBuilder().build())
    .with(
      'safeTxHash',
      faker.string.hexadecimal({
        casing: 'lower',
        prefix: '0x',
        length: 64,
      }) as `0x${string}`,
    )
    .with('gtfFee', gtfFeeBuilder().build())
    .with('pricingContextSnapshot', gtfPricingContextSnapshotBuilder().build());
}
