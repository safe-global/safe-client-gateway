import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { SafeSchema } from '@/modules/safe/domain/entities/schemas/safe.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_union',
        path: ['nonce'],
        message: 'Invalid input',
        errors: [
          [
            expect.objectContaining({
              code: 'invalid_type',
              expected: 'number',
              path: [],
            }),
          ],
          [
            expect.objectContaining({
              code: 'invalid_type',
              expected: 'string',
              path: [],
            }),
          ],
        ],
      }),
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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_type',
        expected: expect.any(String),
        path: ['threshold'],
      }),
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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_type',
        expected: expect.any(String),
        path: ['version'],
      }),
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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_union',
        message: 'Invalid input',
        path: ['nonce'],
        errors: [
          [
            expect.objectContaining({
              code: 'invalid_type',
              expected: 'number',
              path: [],
            }),
          ],
          [
            expect.objectContaining({
              code: 'invalid_type',
              expected: 'string',
              path: [],
            }),
          ],
        ],
      }),
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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_type',
        expected: expect.any(String),
        path: [field],
      }),
    ]);
  });
});
