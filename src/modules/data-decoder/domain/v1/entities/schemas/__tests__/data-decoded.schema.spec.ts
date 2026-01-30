import { fakeJson } from '@/__tests__/faker';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/modules/data-decoder/domain/v1/entities/__tests__/data-decoded.builder';
import {
  DataDecodedParameterSchema,
  DataDecodedSchema,
} from '@/modules/data-decoder/domain/v1/entities/schemas/data-decoded.schema';
import { faker } from '@faker-js/faker';

describe('Data decoded schema', () => {
  describe('DataDecodedParameterSchema', () => {
    it('should validate a valid data decoded parameter', () => {
      const dataDecodedParameter = dataDecodedParameterBuilder().build();

      const result = DataDecodedParameterSchema.safeParse(dataDecodedParameter);

      expect(result.success).toBe(true);
    });

    it.each([
      ['string', faker.string.hexadecimal()],
      ['number', faker.number.int()],
      ['boolean', faker.datatype.boolean()],
      ['null', null],
      ['undefined', undefined],
    ])('should allow value of type %s', (_, value) => {
      const dataDecodedParameter = dataDecodedParameterBuilder()
        .with('value', value as Required<unknown>)
        .build();

      const result = DataDecodedParameterSchema.safeParse(dataDecodedParameter);

      expect(result.success).toBe(true);
    });

    it('should allow record valueDecoded', () => {
      const dataDecodedParameter = dataDecodedParameterBuilder()
        .with('valueDecoded', JSON.parse(fakeJson()) as Record<string, unknown>)
        .build();

      const result = DataDecodedParameterSchema.safeParse(dataDecodedParameter);

      expect(result.success).toBe(true);
    });

    it('should allow array valueDecoded', () => {
      const dataDecodedParameter = dataDecodedParameterBuilder()
        .with('valueDecoded', [
          JSON.parse(fakeJson()) as Record<string, unknown>,
        ])
        .build();

      const result = DataDecodedParameterSchema.safeParse(dataDecodedParameter);

      expect(result.success).toBe(true);
    });

    it('should allow no valueDecoded, defaulting to null', () => {
      const dataDecodedParameter = dataDecodedParameterBuilder().build();
      // @ts-expect-error - inferred type doesn't allow optional parameters
      delete dataDecodedParameter.valueDecoded;

      const result = DataDecodedParameterSchema.safeParse(dataDecodedParameter);

      expect(result.success && result.data.valueDecoded).toBe(null);
    });
  });

  describe('DataDecodedSchema', () => {
    it('should validate a valid data decoded', () => {
      const dataDecoded = dataDecodedBuilder().build();

      const result = DataDecodedSchema.safeParse(dataDecoded);

      expect(result.success).toBe(true);
    });

    it('should allow optional parameters, defaulting to null', () => {
      const dataDecoded = dataDecodedBuilder().build();
      // @ts-expect-error - inferred type doesn't allow optional parameters
      delete dataDecoded.parameters;

      const result = DataDecodedSchema.safeParse(dataDecoded);

      expect(result.success && result.data.parameters).toBe(null);
    });

    it('does not validate invalid decoded data', () => {
      const dataDecoded = { invalid: 'dataDecoded' };

      const result = DataDecodedSchema.safeParse(dataDecoded);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['method'],
          message: 'Invalid input: expected string, received undefined',
        },
      ]);
    });
  });
});
