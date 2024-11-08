import { faker } from '@faker-js/faker';
import {
  deletedDelegateEventBuilder,
  newDelegateEventBuilder,
  updatedDelegateEventBuilder,
} from '@/routes/hooks/entities/__tests__/delegate-events.builder';
import {
  DeletedDelegateEventSchema,
  NewDelegateEventSchema,
  UpdatedDelegateEventSchema,
} from '@/routes/hooks/entities/schemas/delegate-events.schema';
import { getAddress } from 'viem';

describe.each([
  ['NewDelegateEventSchema', NewDelegateEventSchema, newDelegateEventBuilder],
  [
    'UpdatedDelegateEventSchema',
    UpdatedDelegateEventSchema,
    updatedDelegateEventBuilder,
  ],
  [
    'DeletedDelegateEventSchema',
    DeletedDelegateEventSchema,
    deletedDelegateEventBuilder,
  ],
])('%s', (schemaName, Schema, builder) => {
  it(`should validate a ${schemaName}`, () => {
    const event = builder().build();

    const result = Schema.safeParse(event);

    expect(result.success).toBe(true);
  });

  it('should throw if chainId is not a numeric string', () => {
    const event = builder().with('chainId', faker.string.alpha()).build();

    const result = Schema.safeParse(event);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: ['chainId'],
      },
    ]);
  });

  it.each(['address' as const, 'delegate' as const, 'delegator' as const])(
    'should checksum %s',
    (field) => {
      const nonChecksummedAddress = faker.finance.ethereumAddress();
      const event = builder()
        .with(field, nonChecksummedAddress as `0x${string}`)
        .build();

      const result = Schema.safeParse(event);

      expect(result.success && result.data[field]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it.each(['address' as const, 'expiryDateSeconds' as const])(
    'should allow nullish %s, defaulting to null',
    (field) => {
      const event = builder().build();
      delete event[field];

      const result = Schema.safeParse(event);

      expect(result.success && result.data[field]).toBe(null);
    },
  );

  it('should throw if the event is invalid', () => {
    const event = {
      invalid: 'event',
    };

    const result = Schema.safeParse(event);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['chainId'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['delegate'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['delegator'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['label'],
        received: 'undefined',
      },
      {
        code: 'invalid_literal',
        expected: Schema.shape.type.value,
        message: `Invalid literal value, expected "${Schema.shape.type.value}"`,
        path: ['type'],
        received: undefined,
      },
    ]);
  });
});
