// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { txFeesResponseBuilder } from '@/modules/fees/domain/entities/__tests__/tx-fees-response.builder';
import {
  TxDataResponseSchema,
  TxFeesResponseSchema,
} from '@/modules/fees/domain/entities/tx-fees-response.entity';

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

  it.each([
    { chainId: 'abc' },
    { chainId: '' },
    { chainId: '-1' },
    { chainId: -1 },
    { chainId: 0 },
    { chainId: '0' },
    { chainId: 1.5 },
    { chainId: '1.5' },
    { chainId: '01' },
    { chainId: true },
    { chainId: null },
  ])('should not allow an invalid chainId "$chainId"', ({ chainId }) => {
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
  });

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

describe('TxFeesResponseSchema', () => {
  it('should validate a valid tx-fees response', () => {
    const response = txFeesResponseBuilder().build();

    const result = TxFeesResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
  });

  it('should not allow a missing txData', () => {
    const { relayCost } = txFeesResponseBuilder().build();

    const result = TxFeesResponseSchema.safeParse({
      relayCost,
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
    const { txData } = txFeesResponseBuilder().build();

    const result = TxFeesResponseSchema.safeParse({
      txData,
    });

    expect(result.success).toBe(false);
  });
});
