// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { txFeesResponseBuilder } from '@/modules/fees/domain/entities/__tests__/tx-fees-response.builder';
import {
  PricingContextSnapshotSchema,
  TxDataResponseSchema,
  TxFeesResponseSchema,
} from '@/modules/fees/domain/entities/schemas/tx-fees-response.schema';

describe('TxDataResponseSchema', () => {
  it('should accept chainId as a string and keep it as string', () => {
    const txData = {
      chainId: '1',
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
    if (result.success) {
      expect(typeof result.data.chainId).toBe('string');
      expect(result.data.chainId).toBe('1');
    }
  });

  it('should accept chainId as a number and coerce it to string', () => {
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
    if (result.success) {
      expect(typeof result.data.chainId).toBe('string');
      expect(result.data.chainId).toBe('1');
    }
  });

  it.each([{ chainId: 'abc' }, { chainId: '' }, { chainId: '-1' }, { chainId: -1 }])(
    'should not allow an invalid chainId "$chainId"',
    ({ chainId }) => {
      const txData = {
        chainId,
        safeAddress: getAddress(faker.finance.ethereumAddress()),
        safeTxGas: '150000',
        baseGas: '48564',
        gasPrice: '195000000000000',
        gasToken: getAddress(zeroAddress),
        refundReceiver: getAddress(zeroAddress),
        numberSignatures: 2,
      };

      const result = TxDataResponseSchema.safeParse(txData);

      expect(result.success).toBe(false);
    },
  );

  it('should not allow an invalid safeAddress', () => {
    const txData = {
      chainId: '1',
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
      gasPriceVolatilityBuffer: 1.3,
    };

    const result = PricingContextSnapshotSchema.safeParse(pricingContext);

    expect(result.success).toBe(true);
  });

  it('should not allow an invalid priceSource', () => {
    const pricingContext = {
      phase: 1,
      priceSource: 'INVALID_SOURCE',
      priceTimestamp: 1700000000,
      gasPriceVolatilityBuffer: 1.3,
    };

    const result = PricingContextSnapshotSchema.safeParse(pricingContext);

    expect(result.success).toBe(false);
  });
});

describe('TxFeesResponseSchema', () => {
  it('should validate a valid tx-fees response', () => {
    const response = txFeesResponseBuilder().build();

    const result = TxFeesResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
  });

  it('should not allow a missing txData', () => {
    const { relayCost, pricingContextSnapshot } =
      txFeesResponseBuilder().build();

    const result = TxFeesResponseSchema.safeParse({
      relayCost,
      pricingContextSnapshot,
    });

    expect(!result.success && result.error.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid_type',
          path: ['txData'],
        }),
      ]),
    );
  });

  it('should not allow a missing relayCost', () => {
    const { txData, pricingContextSnapshot } = txFeesResponseBuilder().build();

    const result = TxFeesResponseSchema.safeParse({
      txData,
      pricingContextSnapshot,
    });

    expect(result.success).toBe(false);
  });
});
