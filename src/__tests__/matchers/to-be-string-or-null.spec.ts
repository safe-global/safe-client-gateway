// SPDX-License-Identifier: FSL-1.1-MIT
import { describe, expect, it } from 'bun:test';
import '#/__tests__/matchers/to-be-string-or-null';
import { faker } from '@faker-js/faker';

describe('anyStringOrNull', () => {
  it.each([faker.string.sample(), null])(
    'should pass when the input is %s',
    (input) => {
      expect(input).anyStringOrNull();
    },
  );

  // One-element rows: `bun:test` spreads array rows into arguments, so a bare
  // `[]` row would call the test with none (and read as a `done` callback).
  it.each([
    [faker.number.int()],
    [faker.datatype.boolean()],
    [{}],
    [[]],
    [undefined],
    [(): void => {}],
  ])('should fail when the input is %s', (input: unknown) => {
    expect(() => expect(input).anyStringOrNull()).toThrow(
      `expected ${input} to be string or null`,
    );
  });
});
