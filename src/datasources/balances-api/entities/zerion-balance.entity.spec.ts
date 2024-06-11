import {
  zerionAttributesBuilder,
  zerionBalanceBuilder,
  zerionBalancesBuilder,
  zerionFlagsBuilder,
  zerionFungibleInfoBuilder,
  zerionImplementationBuilder,
  zerionQuantityBuilder,
} from '@/datasources/balances-api/entities/__tests__/zerion-balance.entity.builder';
import {
  ZerionAttributesSchema,
  ZerionBalanceSchema,
  ZerionBalancesSchema,
  ZerionFlagsSchema,
  ZerionFungibleInfoSchema,
  ZerionImplementationSchema,
  ZerionQuantitySchema,
} from '@/datasources/balances-api/entities/zerion-balance.entity';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('Zerion Balance Entity schemas', () => {
  describe('ZerionBalancesSchema', () => {
    it('should validate a ZerionBalances object', () => {
      const zerionBalances = zerionBalancesBuilder().build();

      const result = ZerionBalancesSchema.safeParse(zerionBalances);

      expect(result.success).toBe(true);
    });

    it('should not allow invalid', () => {
      const zerionBalances = {
        data: 'invalid',
      };

      const result = ZerionBalancesSchema.safeParse(zerionBalances);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'array',
            received: 'string',
            path: ['data'],
            message: 'Expected array, received string',
          },
        ]),
      );
    });
  });
  describe('ZerionBalanceSchema', () => {
    it('should validate a ZerionBalance object', () => {
      const zerionBalance = zerionBalanceBuilder().build();

      const result = ZerionBalanceSchema.safeParse(zerionBalance);

      expect(result.success).toBe(true);
    });

    it('should not allow an invalid type value', () => {
      const zerionBalance = zerionBalanceBuilder().build();
      // @ts-expect-error - type is expected to be a 'positions' literal
      zerionBalance.type = 'invalid';

      const result = ZerionBalanceSchema.safeParse(zerionBalance);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            received: 'invalid',
            code: 'invalid_literal',
            expected: 'positions',
            path: ['type'],
            message: 'Invalid literal value, expected "positions"',
          },
        ]),
      );
    });

    it('should not allow an invalid id value', () => {
      const zerionBalance = zerionBalanceBuilder().build();
      // @ts-expect-error - id is expected to be a string
      zerionBalance.id = faker.number.int();

      const result = ZerionBalanceSchema.safeParse(zerionBalance);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['id'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });

    it.each(['type' as const, 'id' as const, 'attributes' as const])(
      'should not allow %s to be undefined',
      (key) => {
        const zerionBalance = zerionBalanceBuilder().build();
        delete zerionBalance[key];

        const result = ZerionBalanceSchema.safeParse(zerionBalance);

        expect(
          !result.success &&
            result.error.issues.length === 1 &&
            result.error.issues[0].path.length === 1 &&
            result.error.issues[0].path[0] === key,
        ).toBe(true);
      },
    );
  });

  describe('ZerionAttributesSchema', () => {
    it('should validate a ZerionAttributes object', () => {
      const zerionAttributes = zerionBalanceBuilder().build().attributes;

      const result = ZerionAttributesSchema.safeParse(zerionAttributes);

      expect(result.success).toBe(true);
    });

    it.each(['name' as const, 'quantity' as const])(
      'should not allow %s to be undefined',
      (key) => {
        const zerionAttributes = zerionAttributesBuilder().build();
        delete zerionAttributes[key];

        const result = ZerionAttributesSchema.safeParse(zerionAttributes);

        expect(
          !result.success &&
            result.error.issues.length === 1 &&
            result.error.issues[0].path.length === 1 &&
            result.error.issues[0].path[0] === key,
        ).toBe(true);
      },
    );

    it('should not allow an invalid name value', () => {
      const zerionAttributes = zerionAttributesBuilder().build();
      // @ts-expect-error - name is expected to be a string
      zerionAttributes.name = faker.number.int();

      const result = ZerionAttributesSchema.safeParse(zerionAttributes);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['name'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });

    it('should not allow an invalid value value', () => {
      const zerionAttributes = zerionAttributesBuilder().build();
      // @ts-expect-error - value is expected to be a number
      zerionAttributes.value = faker.string.sample();

      const result = ZerionAttributesSchema.safeParse(zerionAttributes);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'string',
            path: ['value'],
            message: 'Expected number, received string',
          },
        ]),
      );
    });

    it('should not allow an invalid price value', () => {
      const zerionAttributes = zerionAttributesBuilder().build();
      // @ts-expect-error - price is expected to be a number
      zerionAttributes.price = faker.string.sample();

      const result = ZerionAttributesSchema.safeParse(zerionAttributes);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'string',
            path: ['price'],
            message: 'Expected number, received string',
          },
        ]),
      );
    });
  });

  describe('ZerionQuantitySchema', () => {
    it('should validate a ZerionQuantity object', () => {
      const zerionQuantity = zerionQuantityBuilder().build();

      const result = ZerionQuantitySchema.safeParse(zerionQuantity);

      expect(result.success).toBe(true);
    });

    it.each([
      'int' as const,
      'decimals' as const,
      'float' as const,
      'numeric' as const,
    ])('should not allow %s to be undefined', (key) => {
      const zerionQuantity = zerionQuantityBuilder().build();
      delete zerionQuantity[key];

      const result = ZerionQuantitySchema.safeParse(zerionQuantity);

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === key,
      ).toBe(true);
    });

    it('should not allow an invalid int value', () => {
      const zerionQuantity = zerionQuantityBuilder().build();
      // @ts-expect-error - int is expected to be a string
      zerionQuantity.int = faker.number.int();

      const result = ZerionQuantitySchema.safeParse(zerionQuantity);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['int'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });

    it('should not allow an invalid decimals value', () => {
      const zerionQuantity = zerionQuantityBuilder().build();
      // @ts-expect-error - decimals is expected to be a number
      zerionQuantity.decimals = faker.string.sample();

      const result = ZerionQuantitySchema.safeParse(zerionQuantity);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'string',
            path: ['decimals'],
            message: 'Expected number, received string',
          },
        ]),
      );
    });

    it('should not allow an invalid float value', () => {
      const zerionQuantity = zerionQuantityBuilder().build();
      // @ts-expect-error - float is expected to be a number
      zerionQuantity.float = faker.string.sample();

      const result = ZerionQuantitySchema.safeParse(zerionQuantity);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'string',
            path: ['float'],
            message: 'Expected number, received string',
          },
        ]),
      );
    });

    it('should not allow an invalid numeric value', () => {
      const zerionQuantity = zerionQuantityBuilder().build();
      // @ts-expect-error - numeric is expected to be a string
      zerionQuantity.numeric = faker.number.float();

      const result = ZerionQuantitySchema.safeParse(zerionQuantity);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['numeric'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });
  });

  describe('ZerionFlagsSchema', () => {
    it('should validate a ZerionFlags object', () => {
      const zerionFlags = zerionFlagsBuilder().build();

      const result = ZerionFlagsSchema.safeParse(zerionFlags);

      expect(result.success).toBe(true);
    });

    it('should not allow displayable to be undefined', () => {
      const zerionFlags = zerionFlagsBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete zerionFlags.displayable;

      const result = ZerionFlagsSchema.safeParse(zerionFlags);

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === 'displayable',
      ).toBe(true);
    });

    it('should not allow an invalid ZerionFlags', () => {
      const zerionFlags = zerionFlagsBuilder().build();
      // @ts-expect-error - displayable is expected to be a boolean
      zerionFlags.displayable = faker.string.sample();

      const result = ZerionFlagsSchema.safeParse(zerionFlags);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'boolean',
            received: 'string',
            path: ['displayable'],
            message: 'Expected boolean, received string',
          },
        ]),
      );
    });
  });

  describe('ZerionFungibleInfoSchema', () => {
    it('should validate a ZerionFungibleInfo object', () => {
      const zerionFungibleInfo = zerionFungibleInfoBuilder().build();

      const result = ZerionFungibleInfoSchema.safeParse(zerionFungibleInfo);

      expect(result.success).toBe(true);
    });

    it('should not allow an invalid name value', () => {
      const zerionFungibleInfo = zerionFungibleInfoBuilder().build();
      // @ts-expect-error - name is expected to be a string
      zerionFungibleInfo.name = faker.number.int();

      const result = ZerionFungibleInfoSchema.safeParse(zerionFungibleInfo);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['name'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });

    it('should not allow an invalid symbol value', () => {
      const zerionFungibleInfo = zerionFungibleInfoBuilder().build();
      // @ts-expect-error - symbol is expected to be a string
      zerionFungibleInfo.symbol = faker.number.int();

      const result = ZerionFungibleInfoSchema.safeParse(zerionFungibleInfo);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['symbol'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });

    it('should not allow an invalid description value', () => {
      const zerionFungibleInfo = zerionFungibleInfoBuilder().build();
      // @ts-expect-error - description is expected to be a string
      zerionFungibleInfo.description = faker.number.int();

      const result = ZerionFungibleInfoSchema.safeParse(zerionFungibleInfo);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['description'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });

    it('should not allow an invalid icon value', () => {
      const zerionFungibleInfo = zerionFungibleInfoBuilder().build();
      // @ts-expect-error - icon is expected to be an object
      zerionFungibleInfo.icon = faker.string.sample();

      const result = ZerionFungibleInfoSchema.safeParse(zerionFungibleInfo);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'object',
            received: 'string',
            path: ['icon'],
            message: 'Expected object, received string',
          },
        ]),
      );
    });

    it('should not allow an invalid icon url value', () => {
      const zerionFungibleInfo = zerionFungibleInfoBuilder().build();
      // @ts-expect-error - icon url is expected to be a string
      zerionFungibleInfo.icon = { url: faker.number.int() };

      const result = ZerionFungibleInfoSchema.safeParse(zerionFungibleInfo);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['icon', 'url'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });
  });

  describe('ZerionImplementationSchema', () => {
    it('should validate a ZerionImplementation object', () => {
      const zerionImplementation = zerionImplementationBuilder().build();

      const result = ZerionImplementationSchema.safeParse(zerionImplementation);

      expect(result.success).toBe(true);
    });

    it.each(['chain_id' as const, 'decimals' as const])(
      'should not allow %s to be undefined',
      (key) => {
        const zerionImplementation = zerionImplementationBuilder().build();
        delete zerionImplementation[key];

        const result =
          ZerionImplementationSchema.safeParse(zerionImplementation);

        expect(
          !result.success &&
            result.error.issues.length === 1 &&
            result.error.issues[0].path.length === 1 &&
            result.error.issues[0].path[0] === key,
        ).toBe(true);
      },
    );

    it('should not allow an invalid chain_id value', () => {
      const zerionImplementation = zerionImplementationBuilder().build();
      // @ts-expect-error - chain_id is expected to be a string
      zerionImplementation.chain_id = faker.number.int();

      const result = ZerionImplementationSchema.safeParse(zerionImplementation);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['chain_id'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });

    it('should not allow an invalid address value', () => {
      const zerionImplementation = zerionImplementationBuilder().build();
      // @ts-expect-error - address is expected to be a string
      zerionImplementation.address = faker.number.int();

      const result = ZerionImplementationSchema.safeParse(zerionImplementation);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['address'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });

    it('should not allow an invalid decimals value', () => {
      const zerionImplementation = zerionImplementationBuilder().build();
      // @ts-expect-error - decimals is expected to be a number
      zerionImplementation.decimals = faker.string.sample();

      const result = ZerionImplementationSchema.safeParse(zerionImplementation);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'string',
            path: ['decimals'],
            message: 'Expected number, received string',
          },
        ]),
      );
    });
  });
});
