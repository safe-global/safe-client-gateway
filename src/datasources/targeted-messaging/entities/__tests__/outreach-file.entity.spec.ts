import { faker } from '@faker-js/faker';
import { outreachFileBuilder } from '@/datasources/targeted-messaging/entities/__tests__/outreach-file.builder';
import { OutreachFileSchema } from '@/datasources/targeted-messaging/entities/outreach-file.entity';
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
        exact: false,
        inclusive: true,
        message: 'Number must be greater than or equal to 1',
        minimum: 1,
        path: ['campaign_id'],
        type: 'number',
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
      .with('safe_addresses', nonChecksummedAddresses as Array<`0x${string}`>)
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
        message: 'Required',
        path: ['campaign_id'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['campaign_name'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['team_name'],
        received: 'undefined',
      },
      {
        code: 'invalid_date',
        message: 'Invalid date',
        path: ['start_date'],
      },
      {
        code: 'invalid_date',
        message: 'Invalid date',
        path: ['end_date'],
      },
      {
        code: 'invalid_type',
        expected: 'array',
        message: 'Required',
        path: ['safe_addresses'],
        received: 'undefined',
      },
    ]);
  });
});
