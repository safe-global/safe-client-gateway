import { indexingStatusBuilder } from '@/modules/chains/domain/entities/__tests__/indexing-status.builder';
import { IndexingStatusSchema } from '@/modules/indexing/domain/entities/indexing-status.entity';
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
        message: 'Invalid input: expected number, received string',
        path: [key],
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
        message: 'Invalid input: expected number, received undefined',
        path: ['currentBlockNumber'],
      },
      {
        code: 'invalid_type',
        expected: 'date',
        message: 'Invalid input: expected date, received Date',
        received: 'Invalid Date',
        path: ['currentBlockTimestamp'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['erc20BlockNumber'],
      },
      {
        code: 'invalid_type',
        expected: 'date',
        message: 'Invalid input: expected date, received Date',
        received: 'Invalid Date',
        path: ['erc20BlockTimestamp'],
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Invalid input: expected boolean, received undefined',
        path: ['erc20Synced'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['masterCopiesBlockNumber'],
      },
      {
        code: 'invalid_type',
        expected: 'date',
        message: 'Invalid input: expected date, received Date',
        received: 'Invalid Date',
        path: ['masterCopiesBlockTimestamp'],
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Invalid input: expected boolean, received undefined',
        path: ['masterCopiesSynced'],
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Invalid input: expected boolean, received undefined',
        path: ['synced'],
      },
    ]);
  });
});
