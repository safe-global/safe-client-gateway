import { indexingStatusBuilder } from '@/domain/chains/entities/__tests__/indexing-status.builder';
import { IndexingStatusSchema } from '@/domain/indexing/entities/indexing-status.entity';
import { faker } from '@faker-js/faker';

describe('IndexingStatusSchema', () => {
  it('should validate an IndexingStatus', () => {
    const indexingStatus = indexingStatusBuilder().build();

    const result = IndexingStatusSchema.safeParse(indexingStatus);

    expect(result.success).toBe(true);
  });

  it.each([
    'currentBlockNumber' as const,
    'currentBlockTimestamp' as const,
    'erc20BlockNumber' as const,
    'erc20BlockTimestamp' as const,
    'masterCopiesBlockNumber' as const,
    'masterCopiesBlockTimestamp' as const,
    'erc20Synced' as const,
    'masterCopiesSynced' as const,
    'synced' as const,
  ])('should not allow %s to be undefined', (key) => {
    const indexingStatus = indexingStatusBuilder().build();
    delete indexingStatus[key];

    const result = IndexingStatusSchema.safeParse(indexingStatus);

    expect(!result.success && result.error.issues[0].path).toStrictEqual([key]);
  });

  it.each([
    'currentBlockNumber' as const,
    'erc20BlockNumber' as const,
    'masterCopiesBlockNumber' as const,
  ])('should not allow %s to be a numeric string', (key) => {
    const indexingStatus = indexingStatusBuilder()
      .with(key, faker.string.numeric() as unknown as number)
      .build();

    const result = IndexingStatusSchema.safeParse(indexingStatus);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: [key],
        received: 'string',
      },
    ]);
  });

  it.each([
    'currentBlockTimestamp' as const,
    'erc20BlockTimestamp' as const,
    'masterCopiesBlockTimestamp' as const,
  ])('should coerce %s to a date', (key) => {
    const date = faker.date.recent();
    const indexingStatus = indexingStatusBuilder()
      .with(key, date.toString() as unknown as Date)
      .build();

    const result = IndexingStatusSchema.safeParse(indexingStatus);

    // zod does not coerce milliseconds
    date.setMilliseconds(0);
    expect(result.success && result.data[key]).toStrictEqual(date);
  });

  it('should not allow an invalid IndexingStatus', () => {
    const indexingStatus = {
      invalid: 'indexingStatus',
    };

    const result = IndexingStatusSchema.safeParse(indexingStatus);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['currentBlockNumber'],
        received: 'undefined',
      },
      {
        code: 'invalid_date',
        message: 'Invalid date',
        path: ['currentBlockTimestamp'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['erc20BlockNumber'],
        received: 'undefined',
      },
      {
        code: 'invalid_date',
        message: 'Invalid date',
        path: ['erc20BlockTimestamp'],
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Required',
        path: ['erc20Synced'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['masterCopiesBlockNumber'],
        received: 'undefined',
      },
      {
        code: 'invalid_date',
        message: 'Invalid date',
        path: ['masterCopiesBlockTimestamp'],
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Required',
        path: ['masterCopiesSynced'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Required',
        path: ['synced'],
        received: 'undefined',
      },
    ]);
  });
});
