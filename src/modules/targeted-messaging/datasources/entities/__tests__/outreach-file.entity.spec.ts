import { faker } from '@faker-js/faker';
import { outreachFileBuilder } from '@/modules/targeted-messaging/datasources/entities/__tests__/outreach-file.builder';
import { OutreachFileSchema } from '@/modules/targeted-messaging/datasources/entities/outreach-file.entity';
import type { Address } from 'viem';
import { getAddress } from 'viem';

describe('OutreachFileSchema', () => {
  it('should validate an OutreachFile', () => {
    const outreachFile = outreachFileBuilder().build();

    const result = OutreachFileSchema.safeParse(outreachFile);

    expect(result.success).toBe(true);
  });

  it('should throw if campaign_id is less than 1', () => {
    const outreachFile = outreachFileBuilder().with('campaign_id', 0).build();

    const result = OutreachFileSchema.safeParse(outreachFile);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'too_small',
        inclusive: true,
        message: 'Too small: expected number to be >=1',
        minimum: 1,
        path: ['campaign_id'],
        origin: 'number',
      },
    ]);
  });

  it.each(['start_date' as const, 'end_date' as const])(
    'should coerce %s to a date',
    (key) => {
      const date = faker.date.recent();
      const outreachFile = outreachFileBuilder()
        .with(key, date.toString() as unknown as Date)
        .build();

      const result = OutreachFileSchema.safeParse(outreachFile);

      // Zod coerces the date to the nearest millisecond
      date.setMilliseconds(0);
      expect(result.success && result.data[key]).toStrictEqual(date);
    },
  );

  it('should checksum the safe_addresses', () => {
    const nonChecksummedAddresses = faker.helpers.multiple(
      () => faker.finance.ethereumAddress().toLowerCase(),
      { count: { min: 2, max: 5 } },
    );
    const outreachFile = outreachFileBuilder()
      .with('safe_addresses', nonChecksummedAddresses as Array<Address>)
      .build();

    const result = OutreachFileSchema.safeParse(outreachFile);

    expect(result.success && result.data.safe_addresses).toStrictEqual(
      nonChecksummedAddresses.map((address) => {
        return getAddress(address);
      }),
    );
  });

  it('should throw if the OutreachFile is invalid', () => {
    const outreachFile = {
      invalid: 'outreachFile',
    };

    const result = OutreachFileSchema.safeParse(outreachFile);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['campaign_id'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['campaign_name'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['team_name'],
      },
      {
        code: 'invalid_type',
        expected: 'date',
        message: 'Invalid input: expected date, received Date',
        path: ['start_date'],
        received: 'Invalid Date',
      },
      {
        code: 'invalid_type',
        expected: 'date',
        message: 'Invalid input: expected date, received Date',
        path: ['end_date'],
        received: 'Invalid Date',
      },
      {
        code: 'invalid_type',
        expected: 'array',
        message: 'Invalid input: expected array, received undefined',
        path: ['safe_addresses'],
      },
    ]);
  });
});
