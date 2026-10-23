// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { PaginationData } from '#/routes/common/pagination/pagination.data';
import { PaginationCursorSchema } from '#/validation/entities/schemas/pagination-cursor.schema';

describe('PaginationCursorSchema', () => {
  it('should return the default pagination without a cursor', () => {
    const result = PaginationCursorSchema.safeParse(undefined);

    expect(result.success && result.data).toEqual(
      new PaginationData(
        PaginationData.DEFAULT_LIMIT,
        PaginationData.DEFAULT_OFFSET,
      ),
    );
  });

  it('should return the limit and offset of the cursor', () => {
    const limit = faker.number.int({ min: 1, max: 100 });
    const offset = faker.number.int({ min: 0, max: 1_000 });

    const result = PaginationCursorSchema.safeParse(
      `limit=${limit}&offset=${offset}`,
    );

    expect(result.success && result.data).toEqual(
      new PaginationData(limit, offset),
    );
  });

  it('should default a key that is missing from the cursor', () => {
    const offset = faker.number.int({ min: 0, max: 1_000 });

    const result = PaginationCursorSchema.safeParse(`offset=${offset}`);

    expect(result.success && result.data).toEqual(
      new PaginationData(PaginationData.DEFAULT_LIMIT, offset),
    );
  });

  it('should validate the first value of a repeated key', () => {
    const offset = faker.number.int({ min: 0, max: 1_000 });

    const result = PaginationCursorSchema.safeParse(
      `limit=20&offset=-${offset + 1}&offset=${offset}`,
    );

    expect(result.success).toBe(false);
  });

  it.each([
    ['negative', '-1'],
    ['decimal', '1.5'],
    ['infinite', 'Infinity'],
    ['exponent', '1e3'],
    ['trailing characters', '12abc'],
    ['empty', ''],
    ['beyond the safe integer range', '9007199254740993'],
  ])('should reject a %s offset', (_label, offset) => {
    const result = PaginationCursorSchema.safeParse(
      `limit=20&offset=${offset}`,
    );

    expect(result.success).toBe(false);
  });

  it.each([
    ['negative', '-1'],
    ['decimal', '2.5'],
  ])('should reject a %s limit', (_label, limit) => {
    const result = PaginationCursorSchema.safeParse(`limit=${limit}&offset=0`);

    expect(result.success).toBe(false);
  });
});
