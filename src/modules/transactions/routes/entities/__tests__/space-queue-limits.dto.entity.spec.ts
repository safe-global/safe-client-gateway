// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import {
  SPACE_QUEUE_MAX_SAFE_LIMIT,
  SpaceQueueLimitsSchema,
} from '#/modules/transactions/routes/entities/space-queue-limits.dto.entity';

describe('SpaceQueueLimitsSchema', () => {
  const addressA = getAddress(faker.finance.ethereumAddress());
  const addressB = getAddress(faker.finance.ethereumAddress());

  it('reads no limits when the query is missing or empty', () => {
    expect(SpaceQueueLimitsSchema.parse(undefined)).toEqual([]);
    expect(SpaceQueueLimitsSchema.parse('')).toEqual([]);
  });

  it('reads each address:count pair, checksumming the address', () => {
    expect(
      SpaceQueueLimitsSchema.parse(
        `${addressA.toLowerCase()}:3,${addressB}:${SPACE_QUEUE_MAX_SAFE_LIMIT}`,
      ),
    ).toEqual([
      { safeAddress: addressA, limit: 3 },
      { safeAddress: addressB, limit: SPACE_QUEUE_MAX_SAFE_LIMIT },
    ]);
  });

  it.each([
    ['an invalid address', `${faker.word.noun()}:3`],
    ['a missing count', addressA],
    ['a count of zero', `${addressA}:0`],
    ['a fractional count', `${addressA}:1.5`],
    [
      'a count above the maximum',
      `${addressA}:${SPACE_QUEUE_MAX_SAFE_LIMIT + 1}`,
    ],
  ])('rejects %s', (_, value) => {
    expect(SpaceQueueLimitsSchema.safeParse(value).success).toBe(false);
  });

  it('rejects a Safe listed twice, whatever its case', () => {
    expect(
      SpaceQueueLimitsSchema.safeParse(
        `${addressA}:3,${addressA.toLowerCase()}:4`,
      ).success,
    ).toBe(false);
  });
});
