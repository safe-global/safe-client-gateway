import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { SafeSchema } from '@/domain/safe/entities/schemas/safe.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('SafeSchema', () => {
  it('should validate a valid Safe', () => {
    const safe = safeBuilder().build();

    const result = SafeSchema.safeParse(safe);

    expect(result.success).toBe(true);
  });

  it.each([
    'address' as const,
    'masterCopy' as const,
    'fallbackHandler' as const,
    'guard' as const,
  ])('should checksum %s', (field) => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const safe = safeBuilder().with(field, nonChecksummedAddress).build();

    const result = SafeSchema.safeParse(safe);

    expect(result.success && result.data[field]).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  ['nonce' as const, 'threshold' as const].forEach((field) => {
    it(`should allow an integer ${field}`, () => {
      const safe = safeBuilder()
        .with(field, faker.number.int({ min: 1 }))
        .build();

      const result = SafeSchema.safeParse(safe);

      expect(result.success).toBe(true);
    });

    it.each([
      ['boolean', faker.datatype.boolean()],
      ['undefined', undefined],
      ['null', null],
      ['string', faker.string.numeric()],
    ])(`should not allow a %s ${field}`, (type, value) => {
      const safe = safeBuilder()
        .with(field, value as unknown as number)
        .build();

      const result = SafeSchema.safeParse(safe);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: expect.any(String),
          received: type,
          path: [field],
          message: expect.any(String),
        },
      ]);
    });
  });

  it.each(['owners' as const, 'modules' as const])(
    'should checksum the array of %s',
    (field) => {
      const nonChecksummedAddresses = Array.from(
        {
          length: faker.number.int({ min: 1, max: 5 }),
        },
        () => faker.finance.ethereumAddress().toLowerCase() as `0x${string}`,
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

  it.each([
    'address' as const,
    'nonce' as const,
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
