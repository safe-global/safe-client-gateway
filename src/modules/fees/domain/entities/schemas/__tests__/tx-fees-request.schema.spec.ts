// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { TxFeesRequestSchema } from '@/modules/fees/domain/entities/schemas/tx-fees-request.schema';

describe('TxFeesRequestSchema', () => {
  it('should validate a valid tx-fees request', () => {
    const request = {
      to: getAddress(faker.finance.ethereumAddress()),
      value: '1000000000000000000',
      data: '0x',
      operation: 0,
      numberSignatures: 2,
      gasToken: getAddress(zeroAddress),
    };

    const result = TxFeesRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
  });

  it('should not allow an invalid address for to', () => {
    const request = {
      to: 'not-an-address',
      value: '0',
      data: '0x',
      operation: 0,
      numberSignatures: 1,
      gasToken: getAddress(zeroAddress),
    };

    const result = TxFeesRequestSchema.safeParse(request);

    expect(result.success).toBe(false);
  });

  it('should not allow numberSignatures less than 1', () => {
    const request = {
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: '0x',
      operation: 0,
      numberSignatures: 0,
      gasToken: getAddress(zeroAddress),
    };

    const result = TxFeesRequestSchema.safeParse(request);

    expect(!result.success && result.error.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'too_small',
          path: ['numberSignatures'],
        }),
      ]),
    );
  });

  it('should not allow a missing field', () => {
    const result = TxFeesRequestSchema.safeParse({
      to: getAddress(faker.finance.ethereumAddress()),
    });

    expect(result.success).toBe(false);
  });
});
