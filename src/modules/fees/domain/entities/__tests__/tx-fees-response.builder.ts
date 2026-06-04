// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { PriceSource } from '@/modules/fees/domain/entities/price-source.entity';
import type {
  PricingContextSnapshot,
  RelayCost,
  TxDataResponse,
  TxFeesResponse,
} from '@/modules/fees/domain/entities/tx-fees-response.entity';

export function txDataResponseBuilder(): IBuilder<TxDataResponse> {
  return new Builder<TxDataResponse>()
    .with('chainId', faker.number.int({ min: 1, max: 100 }))
    .with('safeAddress', getAddress(faker.finance.ethereumAddress()))
    .with('safeTxGas', faker.string.numeric({ length: 6 }))
    .with('baseGas', faker.string.numeric({ length: 5 }))
    .with('gasPrice', faker.string.numeric({ length: 15 }))
    .with('gasToken', getAddress(zeroAddress))
    .with('refundReceiver', getAddress(zeroAddress))
    .with('numberSignatures', faker.number.int({ min: 1, max: 10 }));
}

export function pricingContextSnapshotBuilder(): IBuilder<PricingContextSnapshot> {
  return new Builder<PricingContextSnapshot>()
    .with('phase', faker.number.int({ min: 1, max: 3 }))
    .with('priceSource', PriceSource.COINGECKO)
    .with('priceTimestamp', faker.number.int())
    .with('gasPriceVolatilityBuffer', faker.number.float({ min: 1, max: 2 }));
}

export function relayCostBuilder(): IBuilder<RelayCost> {
  return new Builder<RelayCost>()
    .with('fiatCode', faker.finance.currencyCode())
    .with('fiatValue', faker.number.float({ min: 0, max: 100 }).toString());
}

export function txFeesResponseBuilder(): IBuilder<TxFeesResponse> {
  return new Builder<TxFeesResponse>()
    .with('txData', txDataResponseBuilder().build())
    .with('relayCost', relayCostBuilder().build())
    .with('pricingContextSnapshot', pricingContextSnapshotBuilder().build());
}
