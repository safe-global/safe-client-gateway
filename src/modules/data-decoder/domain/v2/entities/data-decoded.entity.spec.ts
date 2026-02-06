import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import {
  baseDataDecodedBuilder,
  dataDecodedBuilder,
  multisendBuilder,
  dataDecodedParameterBuilder,
} from '@/modules/data-decoder/domain/v2/entities/__tests__/data-decoded.builder';
import {
  BaseDataDecodedSchema,
  DataDecodedSchema,
  MultisendSchema,
  DataDecodedParameterSchema,
  ValueDecodedSchema,
} from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { DataDecodedAccuracy } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';

describe('DataDecoded', () => {
  describe('MultisendSchema', () => {
    it('should validate a Multisend', () => {
      const multisend = multisendBuilder().build();

      const result = MultisendSchema.safeParse(multisend);

      expect(result.success).toBe(true);
    });

    it('should validate a nested MultiSend', () => {
      const nestedMultisend = multisendBuilder()
        .with(
          'dataDecoded',
          baseDataDecodedBuilder()
            .with('parameters', [
              dataDecodedParameterBuilder()
                .with('valueDecoded', [multisendBuilder().build()])
                .build(),
            ])
            .build(),
        )
        .build();

      const result = MultisendSchema.safeParse(nestedMultisend);

      expect(result.success).toBe(true);
    });

    it('should expect a valid operation', () => {
      const multisend = multisendBuilder()
        .with('operation', faker.number.int({ min: 2 }) as Operation)
        .build();

      const result = MultisendSchema.safeParse(multisend);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_value',
          message: 'Invalid option: expected one of 0|1',
          path: ['operation'],
          values: [0, 1],
        },
      ]);
    });

    it('should expect a numeric string value', () => {
      const multisend = multisendBuilder()
        .with('value', faker.string.hexadecimal())
        .build();

      const result = MultisendSchema.safeParse(multisend);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: ['value'],
        },
      ]);
    });

    it('should checksum the to', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const multisend = multisendBuilder()
        .with('to', nonChecksummedAddress as Address)
        .build();

      const result = MultisendSchema.safeParse(multisend);

      expect(result.success && result.data.to).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should expect hex data', () => {
      const multisend = multisendBuilder()
        .with('data', faker.string.alpha() as Address)
        .build();

      const result = MultisendSchema.safeParse(multisend);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: ['data'],
        },
      ]);
    });

    it('should not validate an invalid Multisend', () => {
      const multisend = { invalid: 'multisend' };

      const result = MultisendSchema.safeParse(multisend);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['to'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['value'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['data'],
        },
        {
          code: 'invalid_value',
          message: 'Invalid option: expected one of 0|1',
          path: ['operation'],
          values: [0, 1],
        },
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Invalid input: expected object, received undefined',
          path: ['dataDecoded'],
        },
      ]);
    });
  });

  describe('ValueDecodedSchema', () => {
    it('should validate a Multisend', () => {
      const multisend = multisendBuilder().build();

      const result = ValueDecodedSchema.safeParse([multisend]);

      expect(result.success).toBe(true);
    });

    it('should validate a nested MultiSend', () => {
      const nestedMultisend = multisendBuilder()
        .with(
          'dataDecoded',
          baseDataDecodedBuilder()
            .with('parameters', [
              dataDecodedParameterBuilder()
                .with('valueDecoded', [multisendBuilder().build()])
                .build(),
            ])
            .build(),
        )
        .build();

      const result = ValueDecodedSchema.safeParse([nestedMultisend]);

      expect(result.success).toBe(true);
    });

    it('should validate a BaseDataDecoded', () => {
      const baseDataDecoded = baseDataDecodedBuilder()
        .with(
          'parameters',
          faker.helpers.multiple(() => dataDecodedParameterBuilder().build(), {
            count: { min: 1, max: 5 },
          }),
        )
        .build();

      const result = ValueDecodedSchema.safeParse(baseDataDecoded);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid ValueDecoded', () => {
      const valueDecoded = { invalid: 'valueDecoded' };

      const result = ValueDecodedSchema.safeParse(valueDecoded);

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          code: 'invalid_union',
          message: 'Invalid input',
          path: [],
          errors: [
            [
              expect.objectContaining({
                code: 'invalid_type',
                expected: 'array',
                path: [],
              }),
            ],
            [
              expect.objectContaining({
                code: 'invalid_type',
                expected: 'string',
                path: ['method'],
              }),
              expect.objectContaining({
                code: 'invalid_type',
                expected: 'array',
                path: ['parameters'],
              }),
            ],
            [
              expect.objectContaining({
                code: 'invalid_type',
                expected: 'null',
                path: [],
              }),
            ],
          ],
        }),
      ]);
    });
  });

  describe('DataDecodedParameterSchema', () => {
    it('should validate a DataDecodedParameter', () => {
      const parameter = dataDecodedParameterBuilder().build();

      const result = DataDecodedParameterSchema.safeParse(parameter);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid DataDecodedParameter', () => {
      const parameter = { invalid: 'dataDecodedParameter' };

      const result = DataDecodedParameterSchema.safeParse(parameter);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['name'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['type'],
        },
      ]);
    });
  });

  describe('BaseDataDecodedSchema', () => {
    it('should validate a BaseDataDecoded', () => {
      const baseDataDecoded = baseDataDecodedBuilder().build();

      const result = BaseDataDecodedSchema.safeParse(baseDataDecoded);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid BaseDataDecoded', () => {
      const baseDataDecoded = { invalid: 'baseDataDecoded' };

      const result = BaseDataDecodedSchema.safeParse(baseDataDecoded);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['method'],
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Invalid input: expected array, received undefined',
          path: ['parameters'],
        },
      ]);
    });
  });

  describe('DataDecodedSchema', () => {
    it('should validate a DataDecoded', () => {
      const dataDecoded = dataDecodedBuilder().build();

      const result = DataDecodedSchema.safeParse(dataDecoded);

      expect(result.success).toBe(true);
    });

    it('should catch invalid accuracy, assigning it as UNKNOWN', () => {
      const dataDecoded = dataDecodedBuilder()
        .with('accuracy', 'invalid' as (typeof DataDecodedAccuracy)[number])
        .build();

      const result = DataDecodedSchema.safeParse(dataDecoded);

      expect(result.success && result.data.accuracy).toBe('UNKNOWN');
    });

    it('should not validate an invalid DataDecoded', () => {
      const dataDecoded = { invalid: 'dataDecoded' };

      const result = DataDecodedSchema.safeParse(dataDecoded);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['method'],
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Invalid input: expected array, received undefined',
          path: ['parameters'],
        },
      ]);
    });
  });
});
