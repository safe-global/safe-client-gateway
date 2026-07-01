// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { gtfFeesResponseBuilder } from '@/modules/fees/domain/entities/__tests__/gtf-fees-response.builder';
import { Origin } from '@/modules/fees/domain/entities/origin.entity';
import {
  GtfFeeBreakdownSchema,
  GtfFeesResponseSchema,
  GtfPricingContextSnapshotSchema,
  GtfTxDataSchema,
  GtfValuationDetailSchema,
} from '@/modules/fees/domain/entities/schemas/gtf-fees-response.schema';

describe('GtfTxDataSchema', () => {
  const validTxData = {
    chainId: '1',
    safeAddress: getAddress(faker.finance.ethereumAddress()),
    to: getAddress(faker.finance.ethereumAddress()),
    value: '0',
    data: '0x',
    operation: 0,
    safeTxGas: '150000',
    baseGas: '48564',
    gasPrice: '195000000000000',
    gasToken: getAddress(zeroAddress),
    refundReceiver: getAddress(zeroAddress),
    nonce: '5',
  };

  it('should accept chainId as a string and keep it as string', () => {
    const result = GtfTxDataSchema.safeParse(validTxData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.chainId).toBe('string');
      expect(result.data.chainId).toBe('1');
    }
  });

  it('should accept chainId as a number and coerce it to string', () => {
    const result = GtfTxDataSchema.safeParse({ ...validTxData, chainId: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.chainId).toBe('string');
      expect(result.data.chainId).toBe('1');
    }
  });

  it.each([
    { chainId: 'abc' },
    { chainId: '' },
    { chainId: '-1' },
    { chainId: -1 },
    { chainId: 0 },
    { chainId: '0' },
  ])('should not allow an invalid chainId "$chainId"', ({ chainId }) => {
    const result = GtfTxDataSchema.safeParse({ ...validTxData, chainId });

    expect(result.success).toBe(false);
  });

  it('should not allow a missing nonce', () => {
    const rest: Partial<typeof validTxData> = { ...validTxData };
    rest.nonce = undefined;

    const result = GtfTxDataSchema.safeParse(rest);

    expect(!result.success && result.error.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['nonce'],
        }),
      ]),
    );
  });

  it('should not allow an invalid safeAddress', () => {
    const result = GtfTxDataSchema.safeParse({
      ...validTxData,
      safeAddress: 'invalid',
    });

    expect(result.success).toBe(false);
  });

  it('should not have a numberSignatures field', () => {
    const result = GtfTxDataSchema.safeParse(validTxData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('numberSignatures');
    }
  });
});

describe('GtfValuationDetailSchema', () => {
  it('should validate a valid valuation detail', () => {
    const valuationDetail = {
      tokenAddress: getAddress(faker.finance.ethereumAddress()),
      symbol: 'USDC',
      amount: '1000',
      priceUsd: 1,
      valueUsd: 1000,
    };

    const result = GtfValuationDetailSchema.safeParse(valuationDetail);

    expect(result.success).toBe(true);
  });

  it('should validate without optional fields (native token transfer)', () => {
    const valuationDetail = {
      symbol: 'ETH',
      amount: '1000000000000000000',
    };

    const result = GtfValuationDetailSchema.safeParse(valuationDetail);

    expect(result.success).toBe(true);
  });

  it('should not allow a missing symbol', () => {
    const result = GtfValuationDetailSchema.safeParse({ amount: '1000' });

    expect(result.success).toBe(false);
  });
});

describe('GtfFeeBreakdownSchema', () => {
  it('should validate a valid fee breakdown', () => {
    const feeBreakdown = {
      txValueUsd: 1000,
      trailingVolumeUsd: 0,
      tierBps: 5,
      gtfFeeUsd: 0.5,
      relayCostUsd: 38.22,
      totalUsd: 38.72,
      numberSignatures: 2,
      valuationDetails: [{ symbol: 'ETH', amount: '1000' }],
    };

    const result = GtfFeeBreakdownSchema.safeParse(feeBreakdown);

    expect(result.success).toBe(true);
  });

  it('should not allow a missing valuationDetails', () => {
    const result = GtfFeeBreakdownSchema.safeParse({
      txValueUsd: 1000,
      trailingVolumeUsd: 0,
      tierBps: 5,
      gtfFeeUsd: 0.5,
      relayCostUsd: 38.22,
      totalUsd: 38.72,
      numberSignatures: 2,
    });

    expect(result.success).toBe(false);
  });
});

describe('GtfPricingContextSnapshotSchema', () => {
  it('should validate a valid pricing context snapshot without a phase field', () => {
    const pricingContext = {
      priceSource: 'COINGECKO',
      priceTimestamp: 1700000000,
      gasPriceVolatilityBuffer: 1.3,
      tierBps: 5,
      origin: Origin.NATIVE,
      maxFeeCapUsd: 500,
    };

    const result = GtfPricingContextSnapshotSchema.safeParse(pricingContext);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('phase');
    }
  });

  it('should not allow an invalid priceSource', () => {
    const pricingContext = {
      priceSource: 'INVALID_SOURCE',
      priceTimestamp: 1700000000,
      gasPriceVolatilityBuffer: 1.3,
      tierBps: 5,
      origin: Origin.NATIVE,
      maxFeeCapUsd: 500,
    };

    const result = GtfPricingContextSnapshotSchema.safeParse(pricingContext);

    expect(result.success).toBe(false);
  });

  it('should not allow a missing origin', () => {
    const result = GtfPricingContextSnapshotSchema.safeParse({
      priceSource: 'COINGECKO',
      priceTimestamp: 1700000000,
      gasPriceVolatilityBuffer: 1.3,
      tierBps: 5,
      maxFeeCapUsd: 500,
    });

    expect(result.success).toBe(false);
  });

  it('should not allow a missing maxFeeCapUsd', () => {
    const result = GtfPricingContextSnapshotSchema.safeParse({
      priceSource: 'COINGECKO',
      priceTimestamp: 1700000000,
      gasPriceVolatilityBuffer: 1.3,
      tierBps: 5,
      origin: Origin.NATIVE,
    });

    expect(result.success).toBe(false);
  });
});

describe('GtfFeesResponseSchema', () => {
  it('should validate a valid gtf-fees response', () => {
    const response = gtfFeesResponseBuilder().build();

    const result = GtfFeesResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
  });

  it('should not allow a missing txData', () => {
    const { safeTxHash, feeBreakdown, pricingContextSnapshot } =
      gtfFeesResponseBuilder().build();

    const result = GtfFeesResponseSchema.safeParse({
      safeTxHash,
      feeBreakdown,
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

  it('should not allow a missing safeTxHash', () => {
    const { txData, feeBreakdown, pricingContextSnapshot } =
      gtfFeesResponseBuilder().build();

    const result = GtfFeesResponseSchema.safeParse({
      txData,
      feeBreakdown,
      pricingContextSnapshot,
    });

    expect(result.success).toBe(false);
  });

  it('should not allow a missing feeBreakdown', () => {
    const { txData, safeTxHash, pricingContextSnapshot } =
      gtfFeesResponseBuilder().build();

    const result = GtfFeesResponseSchema.safeParse({
      txData,
      safeTxHash,
      pricingContextSnapshot,
    });

    expect(result.success).toBe(false);
  });
});
