import { getDataDecodedDtoBuilder } from '@/routes/data-decode/entities/__tests__/get-data-decoded.dto.builder';
import { GetDataDecodedDtoSchema } from '@/routes/data-decode/entities/schemas/get-data-decoded.dto.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('GetDataDecodedDtoSchema', () => {
  it('should validate a valid GetDataDecodedDto', () => {
    const getDataDecodedDto = getDataDecodedDtoBuilder().build();

    const result = GetDataDecodedDtoSchema.safeParse(getDataDecodedDto);

    expect(result.success).toBe(true);
  });

  it('should checksum the to', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const getDataDecodedDto = getDataDecodedDtoBuilder()
      .with('to', nonChecksummedAddress)
      .build();

    const result = GetDataDecodedDtoSchema.safeParse(getDataDecodedDto);

    expect(result.success && result.data.to).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow optional to', () => {
    const getDataDecodedDto = getDataDecodedDtoBuilder().build();

    const result = GetDataDecodedDtoSchema.safeParse(getDataDecodedDto);

    expect(result.success).toBe(true);
  });

  it('should not allow non-hex data', () => {
    const getDataDecodedDto = getDataDecodedDtoBuilder()
      .with('data', 'non-hex' as `0x${string}`)
      .build();

    const result = GetDataDecodedDtoSchema.safeParse(getDataDecodedDto);

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

  it('should not allow no hex', () => {
    const getDataDecodedDto = getDataDecodedDtoBuilder().build();
    // @ts-expect-error - inferred type does not allow optional propety
    delete getDataDecodedDto.data;

    const result = GetDataDecodedDtoSchema.safeParse(getDataDecodedDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['data'],
          message: 'Required',
        },
      ]),
    );
  });

  it('should not validate an invalid GetDataDecodedDto', () => {
    const getDataDecodedDto = { invalid: 'getDataDecodedDto' };

    const result = GetDataDecodedDtoSchema.safeParse(getDataDecodedDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['data'],
          message: 'Required',
        },
      ]),
    );
  });
});
