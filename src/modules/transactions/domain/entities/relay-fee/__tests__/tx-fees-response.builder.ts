// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  PricingContextSnapshot,
  TxDataResponse,
  TxFeesResponse,
} from '@/modules/transactions/domain/entities/relay-fee/tx-fees-response.dto';
import { PriceSource } from '@/modules/transactions/domain/entities/relay-fee/tx-fees-response.dto';

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
    .with('gasVolatilityBuffer', faker.number.float({ min: 1, max: 2 }));
}

export function txFeesResponseBuilder(): IBuilder<TxFeesResponse> {
  return new Builder<TxFeesResponse>()
    .with('txData', txDataResponseBuilder().build())
    .with('relayCostUsd', faker.number.float({ min: 0, max: 100 }))
    .with('pricingContextSnapshot', pricingContextSnapshotBuilder().build());
}
