// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import {
  legacyTxFeesResponseBuilder,
  txFeesResponseBuilder,
} from '@/modules/fees/domain/entities/__tests__/tx-fees-response.builder';
import {
  PricingContextSnapshotSchema,
  TxDataResponseSchema,
  TxFeesResponseSchema,
} from '@/modules/fees/domain/entities/schemas/tx-fees-response.schema';

describe('TxDataResponseSchema', () => {
  it('should validate valid tx data', () => {
    const txData = {
      chainId: 1,
      safeAddress: getAddress(faker.finance.ethereumAddress()),
      safeTxGas: '150000',
      baseGas: '48564',
      gasPrice: '195000000000000',
      gasToken: getAddress(zeroAddress),
      refundReceiver: getAddress(zeroAddress),
      numberSignatures: 2,
    };

    const result = TxDataResponseSchema.safeParse(txData);

    expect(result.success).toBe(true);
  });

  it('should not allow an invalid safeAddress', () => {
    const txData = {
      chainId: 1,
      safeAddress: 'invalid',
      safeTxGas: '150000',
      baseGas: '48564',
      gasPrice: '195000000000000',
      gasToken: getAddress(zeroAddress),
      refundReceiver: getAddress(zeroAddress),
      numberSignatures: 2,
    };

    const result = TxDataResponseSchema.safeParse(txData);

    expect(result.success).toBe(false);
  });
});

describe('PricingContextSnapshotSchema', () => {
  it('should validate a valid pricing context', () => {
    const pricingContext = {
      phase: 1,
      priceSource: 'COINGECKO',
      priceTimestamp: 1700000000,
      gasVolatilityBuffer: 1.3,
    };

    const result = PricingContextSnapshotSchema.safeParse(pricingContext);

    expect(result.success).toBe(true);
  });

  it('should not allow an invalid priceSource', () => {
    const pricingContext = {
      phase: 1,
      priceSource: 'INVALID_SOURCE',
      priceTimestamp: 1700000000,
      gasVolatilityBuffer: 1.3,
    };

    const result = PricingContextSnapshotSchema.safeParse(pricingContext);

    expect(result.success).toBe(false);
  });
});

describe('TxFeesResponseSchema', () => {
  it('should validate a response with relayCost', () => {
    const response = txFeesResponseBuilder().build();

    const result = TxFeesResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
  });

  it('should validate a legacy response with relayCostUsd', () => {
    const response = legacyTxFeesResponseBuilder().build();

    const result = TxFeesResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
  });

  it('should not allow a missing txData', () => {
    const response = {
      relayCost: { fiatCode: 'USD', fiatValue: '38.22' },
      pricingContextSnapshot: {
        phase: 1,
        priceSource: 'COINGECKO',
        priceTimestamp: 1700000000,
        gasVolatilityBuffer: 1.3,
      },
    };

    const result = TxFeesResponseSchema.safeParse(response);

    expect(!result.success && result.error.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid_union',
          errors: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({
                code: 'invalid_type',
                path: ['txData'],
              }),
            ]),
          ]),
        }),
      ]),
    );
  });

  it('should not allow a response missing both relayCost and relayCostUsd', () => {
    const { txData, pricingContextSnapshot } = txFeesResponseBuilder().build();

    const result = TxFeesResponseSchema.safeParse({
      txData,
      pricingContextSnapshot,
    });

    expect(result.success).toBe(false);
  });
});
