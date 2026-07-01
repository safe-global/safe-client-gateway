// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { Origin } from '@/modules/fees/domain/entities/origin.entity';
import { GtfFeesRequestSchema } from '@/modules/fees/domain/entities/schemas/gtf-fees-request.schema';

describe('GtfFeesRequestSchema', () => {
  it('should validate a valid gtf-fees request', () => {
    const request = {
      to: getAddress(faker.finance.ethereumAddress()),
      value: '1000000000000000000',
      data: '0x',
      operation: 0,
      numberSignatures: 2,
      nonce: '5',
      gasToken: getAddress(zeroAddress),
      origin: Origin.SAFE_APP,
    };

    const result = GtfFeesRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
  });

  it('should validate a valid gtf-fees request without an origin', () => {
    const request = {
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: '0x',
      operation: 0,
      numberSignatures: 1,
      nonce: '0',
      gasToken: getAddress(zeroAddress),
    };

    const result = GtfFeesRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
  });

  it('should not allow an invalid origin', () => {
    const request = {
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: '0x',
      operation: 0,
      numberSignatures: 1,
      nonce: '0',
      gasToken: getAddress(zeroAddress),
      origin: 'INVALID_ORIGIN',
    };

    const result = GtfFeesRequestSchema.safeParse(request);

    expect(result.success).toBe(false);
  });

  it('should not allow an invalid address for to', () => {
    const request = {
      to: 'not-an-address',
      value: '0',
      data: '0x',
      operation: 0,
      numberSignatures: 1,
      nonce: '0',
      gasToken: getAddress(zeroAddress),
    };

    const result = GtfFeesRequestSchema.safeParse(request);

    expect(result.success).toBe(false);
  });

  it('should not allow numberSignatures less than 1', () => {
    const request = {
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: '0x',
      operation: 0,
      numberSignatures: 0,
      nonce: '0',
      gasToken: getAddress(zeroAddress),
    };

    const result = GtfFeesRequestSchema.safeParse(request);

    expect(!result.success && result.error.issues).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'too_small',
          path: ['numberSignatures'],
        }),
      ]),
    );
  });

  it('should not allow a missing nonce', () => {
    const request = {
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: '0x',
      operation: 0,
      numberSignatures: 1,
      gasToken: getAddress(zeroAddress),
    };

    const result = GtfFeesRequestSchema.safeParse(request);

    expect(!result.success && result.error.issues).toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['nonce'] })]),
    );
  });

  it.each([
    ['hex', '0x12'],
    ['negative', '-12'],
    ['decimal', '1.5'],
    ['non-numeric', 'abc'],
  ])('should reject a %s nonce', (_label, nonce) => {
    const request = {
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: '0x',
      operation: 0,
      numberSignatures: 1,
      nonce,
      gasToken: getAddress(zeroAddress),
    };

    const result = GtfFeesRequestSchema.safeParse(request);

    expect(!result.success && result.error.issues).toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['nonce'] })]),
    );
  });

  it('should not allow a missing field', () => {
    const result = GtfFeesRequestSchema.safeParse({
      to: getAddress(faker.finance.ethereumAddress()),
    });

    expect(result.success).toBe(false);
  });
});
