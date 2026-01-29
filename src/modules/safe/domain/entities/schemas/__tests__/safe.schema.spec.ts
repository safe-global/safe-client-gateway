import {
  safeBuilder,
  safeV2Builder,
} from '@/modules/safe/domain/entities/__tests__/safe.builder';
import {
  SafeSchema,
  SafeSchemaV2,
} from '@/modules/safe/domain/entities/schemas/safe.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import { ZodError } from 'zod';

describe('SafeSchema', () => {
  it('should validate a valid Safe', () => {
    const safe = safeBuilder().build();

    const result = SafeSchema.safeParse(safe);

    expect(result.success).toBe(true);
  });

  it('should coerce a string nonce to a number', () => {
    const safe = safeBuilder()
      .with('nonce', faker.string.numeric() as unknown as number)
      .build();

    const result = SafeSchema.safeParse(safe);

    expect(result.success && result.data.nonce).toBe(Number(safe.nonce));
  });

  it.each([
    'address' as const,
    'masterCopy' as const,
    'fallbackHandler' as const,
    'guard' as const,
  ])('should checksum %s', (field) => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
    const safe = safeBuilder().with(field, nonChecksummedAddress).build();

    const result = SafeSchema.safeParse(safe);

    expect(result.success && result.data[field]).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow an integer nonce', () => {
    const safe = safeBuilder()
      .with('nonce', faker.number.int({ min: 0 }))
      .build();

    const result = SafeSchema.safeParse(safe);

    expect(result.success).toBe(true);
  });

  it.each([
    ['boolean' as const, faker.datatype.boolean(), undefined],
    ['undefined' as const, undefined, 'Required'],
    ['null' as const, null, undefined],
  ])('should not allow a %s nonce', (type, value, message) => {
    const safe = safeBuilder()
      .with('nonce', value as unknown as number)
      .build();

    const result = SafeSchema.safeParse(safe);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_union',
        unionErrors: [
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'number',
              received: type,
              path: ['nonce'],
              message: message ?? `Expected number, received ${type}`,
            },
          ]),
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'string',
              received: type,
              path: ['nonce'],
              message: message ?? `Expected string, received ${type}`,
            },
          ]),
        ],
        path: ['nonce'],
        message: 'Invalid input',
      },
    ]);
  });

  it('should allow an integer threshold', () => {
    const safe = safeBuilder()
      .with('threshold', faker.number.int({ min: 1 }))
      .build();

    const result = SafeSchema.safeParse(safe);

    expect(result.success).toBe(true);
  });

  it.each([
    ['boolean', faker.datatype.boolean()],
    ['undefined', undefined],
    ['null', null],
    ['string', faker.string.numeric()],
  ])('should not allow a %s threshold', (type, value) => {
    const safe = safeBuilder()
      .with('threshold', value as unknown as number)
      .build();

    const result = SafeSchema.safeParse(safe);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: expect.any(String),
        received: type,
        path: ['threshold'],
        message: expect.any(String),
      },
    ]);
  });

  it.each(['owners' as const, 'modules' as const])(
    'should checksum the array of %s',
    (field) => {
      const nonChecksummedAddresses = faker.helpers.multiple(
        () => faker.finance.ethereumAddress().toLowerCase() as Address,
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder().with(field, nonChecksummedAddresses).build();

      const result = SafeSchema.safeParse(safe);

      expect(result.success && result.data[field]).toStrictEqual(
        nonChecksummedAddresses.map((nonChecksummedAddresses) =>
          getAddress(nonChecksummedAddresses),
        ),
      );
    },
  );

  it('should allow a semver version', () => {
    const safe = safeBuilder().with('version', faker.system.semver()).build();

    const result = SafeSchema.safeParse(safe);

    expect(result.success).toBe(true);
  });

  it.each([
    ['boolean', faker.datatype.boolean()],
    ['number', faker.number.int({ min: 1 })],
  ])(`should not allow a %s version`, (type, value) => {
    const safe = safeBuilder()
      .with('version', value as unknown as string)
      .build();

    const result = SafeSchema.safeParse(safe);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: expect.any(String),
        received: type,
        path: ['version'],
        message: `Expected string, received ${type}`,
      },
    ]);
  });

  it.each(['modules' as const, 'version' as const])(
    'should allow optional %s, defaulting to null',
    (field) => {
      const safe = safeBuilder().build();
      delete safe[field];

      const result = SafeSchema.safeParse(safe);

      expect(result.success && result.data[field]).toBe(null);
    },
  );

  it('should not allow optional nonce', () => {
    const safe = safeBuilder().build();
    // @ts-expect-error nonce is not optional
    delete safe.nonce;

    const result = SafeSchema.safeParse(safe);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_union',
        message: 'Invalid input',
        path: ['nonce'],
        unionErrors: [
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'number',
              received: 'undefined',
              path: ['nonce'],
              message: 'Required',
            },
          ]),
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'string',
              received: 'undefined',
              path: ['nonce'],
              message: 'Required',
            },
          ]),
        ],
      },
    ]);
  });

  it.each([
    'address' as const,
    'threshold' as const,
    'owners' as const,
    'masterCopy' as const,
    'fallbackHandler' as const,
    'guard' as const,
  ])('should not allow optional %s', (field) => {
    const safe = safeBuilder().build();
    delete safe[field];

    const result = SafeSchema.safeParse(safe);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: expect.any(String),
        received: 'undefined',
        path: [field],
        message: 'Required',
      },
    ]);
  });
});

describe('SafeSchemaV2', () => {
  it('should validate a valid SafeV2', () => {
    const safeV2 = safeV2Builder().build();

    const result = SafeSchemaV2.safeParse(safeV2);

    expect(result.success).toBe(true);
  });

  it('should coerce a string nonce to a number', () => {
    const safeV2 = safeV2Builder()
      .with('nonce', faker.string.numeric() as unknown as number)
      .build();

    const result = SafeSchemaV2.safeParse(safeV2);

    expect(result.success && result.data.nonce).toBe(Number(safeV2.nonce));
  });

  it.each([
    'address' as const,
    'masterCopy' as const,
    'fallbackHandler' as const,
  ])('should checksum %s', (field) => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
    const safeV2 = safeV2Builder().with(field, nonChecksummedAddress).build();

    const result = SafeSchemaV2.safeParse(safeV2);

    expect(result.success && result.data[field]).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each(['guard' as const, 'moduleGuard' as const])(
    'should checksum %s when provided',
    (field) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as Address;
      const safeV2 = safeV2Builder()
        .with(field, nonChecksummedAddress)
        .build();

      const result = SafeSchemaV2.safeParse(safeV2);

      expect(result.success && result.data[field]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it('should allow an integer nonce', () => {
    const safeV2 = safeV2Builder()
      .with('nonce', faker.number.int({ min: 0 }))
      .build();

    const result = SafeSchemaV2.safeParse(safeV2);

    expect(result.success).toBe(true);
  });

  it.each([
    ['boolean' as const, faker.datatype.boolean(), undefined],
    ['undefined' as const, undefined, 'Required'],
    ['null' as const, null, undefined],
  ])('should not allow a %s nonce', (type, value, message) => {
    const safeV2 = safeV2Builder()
      .with('nonce', value as unknown as number)
      .build();

    const result = SafeSchemaV2.safeParse(safeV2);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_union',
        unionErrors: [
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'number',
              received: type,
              path: ['nonce'],
              message: message ?? `Expected number, received ${type}`,
            },
          ]),
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'string',
              received: type,
              path: ['nonce'],
              message: message ?? `Expected string, received ${type}`,
            },
          ]),
        ],
        path: ['nonce'],
        message: 'Invalid input',
      },
    ]);
  });

  it('should allow an integer threshold', () => {
    const safeV2 = safeV2Builder()
      .with('threshold', faker.number.int({ min: 1 }))
      .build();

    const result = SafeSchemaV2.safeParse(safeV2);

    expect(result.success).toBe(true);
  });

  it.each([
    ['boolean', faker.datatype.boolean()],
    ['undefined', undefined],
    ['null', null],
    ['string', faker.string.numeric()],
  ])('should not allow a %s threshold', (type, value) => {
    const safeV2 = safeV2Builder()
      .with('threshold', value as unknown as number)
      .build();

    const result = SafeSchemaV2.safeParse(safeV2);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: expect.any(String),
        received: type,
        path: ['threshold'],
        message: expect.any(String),
      },
    ]);
  });

  it.each(['owners' as const, 'enabledModules' as const])(
    'should checksum the array of %s',
    (field) => {
      const nonChecksummedAddresses = faker.helpers.multiple(
        () => faker.finance.ethereumAddress().toLowerCase() as Address,
        {
          count: { min: 1, max: 5 },
        },
      );
      const safeV2 = safeV2Builder()
        .with(field, nonChecksummedAddresses)
        .build();

      const result = SafeSchemaV2.safeParse(safeV2);

      expect(result.success && result.data[field]).toStrictEqual(
        nonChecksummedAddresses.map((nonChecksummedAddress) =>
          getAddress(nonChecksummedAddress),
        ),
      );
    },
  );

  it('should not allow optional nonce', () => {
    const safeV2 = safeV2Builder().build();
    // @ts-expect-error nonce is not optional
    delete safeV2.nonce;

    const result = SafeSchemaV2.safeParse(safeV2);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_union',
        message: 'Invalid input',
        path: ['nonce'],
        unionErrors: [
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'number',
              received: 'undefined',
              path: ['nonce'],
              message: 'Required',
            },
          ]),
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'string',
              received: 'undefined',
              path: ['nonce'],
              message: 'Required',
            },
          ]),
        ],
      },
    ]);
  });

  it.each([
    'address' as const,
    'owners' as const,
    'threshold' as const,
    'masterCopy' as const,
    'fallbackHandler' as const,
    'enabledModules' as const,
  ])('should not allow optional %s', (field) => {
    const safeV2 = safeV2Builder().build();
    delete safeV2[field];

    const result = SafeSchemaV2.safeParse(safeV2);

    expect(!result.success && result.error.issues).toContainEqual(
      expect.objectContaining({
        path: [field],
        message: 'Required',
      }),
    );
  });

  it.each(['guard' as const, 'moduleGuard' as const])(
    'should allow null %s',
    (field) => {
      const safeV2 = safeV2Builder().with(field, null).build();

      const result = SafeSchemaV2.safeParse(safeV2);

      expect(result.success).toBe(true);
      expect(result.success && result.data[field]).toBe(null);
    },
  );

  it.each(['guard' as const, 'moduleGuard' as const])(
    'should not allow undefined %s',
    (field) => {
      const safeV2 = safeV2Builder().build();
      delete safeV2[field];

      const result = SafeSchemaV2.safeParse(safeV2);

      expect(!result.success && result.error.issues).toContainEqual(
        expect.objectContaining({
          path: [field],
          message: 'Required',
        }),
      );
    },
  );
});
