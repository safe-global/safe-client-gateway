import { getEstimationDtoBuilder } from '@/routes/estimations/entities/__tests__/get-estimation.dto.builder';
import { GetEstimationDtoSchema } from '@/routes/estimations/entities/schemas/get-estimation.dto.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('GetEstimationDtoSchema', () => {
  it('should validate a valid GetEstimationDto', () => {
    const getEstimationDto = getEstimationDtoBuilder().build();

    const result = GetEstimationDtoSchema.safeParse(getEstimationDto);

    expect(result.success).toBe(true);
  });

  it('should checksum the to field', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const getEstimationDto = getEstimationDtoBuilder()
      .with('to', nonChecksummedAddress)
      .build();

    const result = GetEstimationDtoSchema.safeParse(getEstimationDto);

    expect(result.success && result.data.to).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow hex data', () => {
    const hexData = faker.string.hexadecimal() as `0x${string}`;
    const getEstimationDto = getEstimationDtoBuilder()
      .with('data', hexData)
      .build();

    const result = GetEstimationDtoSchema.safeParse(getEstimationDto);

    expect(result.success).toBe(true);
  });

  it('should not allow non-hex data', () => {
    const nonHexData = faker.string.alphanumeric();
    const getEstimationDto = getEstimationDtoBuilder()
      .with('data', nonHexData as `0x${string}`)
      .build();

    const result = GetEstimationDtoSchema.safeParse(getEstimationDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'Invalid input',
          path: ['data'],
        },
      ]),
    );
  });

  it('should allow nullish data, defaulting to null', () => {
    const getEstimationDto = getEstimationDtoBuilder().build();
    // @ts-expect-error - inferred type does not allow optional properties
    delete getEstimationDto.data;

    const result = GetEstimationDtoSchema.safeParse(getEstimationDto);

    expect(result.success && result.data.data).toBe(null);
  });

  it.each([0, 1])('should allow %s as operation', (operation) => {
    const getEstimationDto = getEstimationDtoBuilder()
      .with('operation', operation)
      .build();

    const result = GetEstimationDtoSchema.safeParse(getEstimationDto);

    expect(result.success).toBe(true);
  });

  it('should not allow non-enum operation', () => {
    const getEstimationDto = getEstimationDtoBuilder()
      .with('operation', 2 as 0 | 1)
      .build();

    const result = GetEstimationDtoSchema.safeParse(getEstimationDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: 2,
          code: 'invalid_enum_value',
          options: [0, 1],
          path: ['operation'],
          message: "Invalid enum value. Expected 0 | 1, received '2'",
        },
      ]),
    );
  });

  it.each(['to' as const, 'value' as const, 'operation' as const])(
    'should not allow %s to be undefined',
    (key) => {
      const getEstimationDto = getEstimationDtoBuilder().build();
      delete getEstimationDto[key];

      const result = GetEstimationDtoSchema.safeParse(getEstimationDto);

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === key,
      ).toBe(true);
    },
  );
});
