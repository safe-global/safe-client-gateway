import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import {
  _TypedDataDomainSchema,
  TypedDataSchema,
  type TypedData,
} from '@/domain/messages/entities/typed-data.entity';
import {
  typedDataBuilder,
  typedDataDomainBuilder,
} from '@/routes/messages/entities/__tests__/typed-data.builder';

describe('TypedDataSchema', () => {
  it('should validate TypedData', () => {
    const typedData = typedDataBuilder().build();

    const result = TypedDataSchema.safeParse(typedData);

    expect(result.success).toBe(true);
  });

  it("shouldn't validate invalid TypedData", () => {
    const typedData = { invalid: 'typedData' };

    const result = TypedDataSchema.safeParse(typedData);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Required',
        path: ['domain'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['primaryType'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Required',
        path: ['types'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Required',
        path: ['message'],
        received: 'undefined',
      },
    ]);
  });

  describe('domain', () => {
    it('should validate a TypedDataDomain domain', () => {
      const domain = typedDataDomainBuilder().build();

      const result = _TypedDataDomainSchema.safeParse(domain);

      expect(result.success).toBe(true);
    });

    it('should accept an empty string as a domain name', () => {
      const domain = typedDataDomainBuilder().with('name', '').build();

      const result = _TypedDataDomainSchema.safeParse(domain);

      expect(result.success).toBe(true);
    });

    it.each([
      ['string', faker.string.numeric()],
      ['number', faker.number.int()],
    ])('should accept a %s chainId, coercing it to a number', (_, chainId) => {
      const domain = typedDataDomainBuilder()
        .with('chainId', chainId as unknown as number)
        .build();

      const result = _TypedDataDomainSchema.safeParse(domain);

      expect(result.success && result.data.chainId).toBe(Number(chainId));
    });

    it('should require a hex salt', () => {
      const domain = typedDataDomainBuilder()
        .with('salt', faker.string.alpha() as `0x${string}`)
        .build();

      const result = _TypedDataDomainSchema.safeParse(domain);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: ['salt'],
        },
      ]);
    });

    it('should checksum the verifyingContract', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const domain = typedDataDomainBuilder()
        .with('verifyingContract', nonChecksummedAddress)
        .build();

      const result = _TypedDataDomainSchema.safeParse(domain);

      expect(result.success && result.data.verifyingContract).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it.each(Object.keys(typedDataDomainBuilder().build()))(
      'should allow an optional %s',
      (key) => {
        const domain = typedDataDomainBuilder().build();
        // @ts-expect-error - Object.keys is not type safe
        delete domain[key];

        const result = _TypedDataDomainSchema.safeParse(domain);

        expect(result.success).toBe(true);
      },
    );
  });

  describe('types', () => {
    it('should validate TypedDataParameters', () => {
      const types = faker.helpers
        .multiple(() => faker.lorem.word())
        .reduce<TypedData['types']>((acc, cur) => {
          acc[cur] = faker.helpers.multiple(() => ({
            name: faker.lorem.word(),
            type: faker.lorem.word(),
          }));
          return acc;
        }, {});

      const result = TypedDataSchema.shape.types.safeParse(types);

      expect(result.success).toBe(true);
    });

    it("shouldn't validate invalid TypedDataParamters", () => {
      const types = { invalid: 'types' };

      const result = TypedDataSchema.shape.types.safeParse(types);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Expected array, received string',
          path: ['invalid'],
          received: 'string',
        },
      ]);
    });
  });
});
