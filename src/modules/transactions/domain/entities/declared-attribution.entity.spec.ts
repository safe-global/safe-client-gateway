// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { declaredAttributionBuilder } from '#/modules/transactions/domain/entities/__tests__/declared-attribution.builder';
import {
  DECLARED_APP_NAME_MAX_LENGTH,
  DECLARED_APP_URL_MAX_LENGTH,
  DECLARED_CHANNEL_MAX_LENGTH,
  DeclaredAttributionSchema,
} from '#/modules/transactions/domain/entities/declared-attribution.entity';

describe('DeclaredAttributionSchema', () => {
  it('should accept a valid declared attribution', () => {
    const declared = declaredAttributionBuilder().build();

    const result = DeclaredAttributionSchema.safeParse(declared);

    expect(result.success && result.data).toEqual(declared);
  });

  it('should default missing fields to null', () => {
    const result = DeclaredAttributionSchema.safeParse({});

    expect(result.success && result.data).toEqual({
      channel: null,
      appName: null,
      appUrl: null,
      appId: null,
    });
  });

  it('should pass an unknown channel through', () => {
    const channel = faker.string.alpha({ length: { min: 1, max: 20 } });
    const declared = declaredAttributionBuilder()
      .with('channel', channel)
      .build();

    const result = DeclaredAttributionSchema.safeParse(declared);

    expect(result.success && result.data.channel).toBe(channel);
  });

  const textFields = [
    ['channel', DECLARED_CHANNEL_MAX_LENGTH],
    ['appName', DECLARED_APP_NAME_MAX_LENGTH],
    ['appUrl', DECLARED_APP_URL_MAX_LENGTH],
  ] as const;

  it.each(textFields)(
    'should keep %s at exactly the maximum length',
    (field, maxLength) => {
      const value = faker.string.alpha({ length: maxLength });
      const declared = declaredAttributionBuilder().with(field, value).build();

      const result = DeclaredAttributionSchema.safeParse(declared);

      expect(result.success && result.data[field]).toBe(value);
    },
  );

  it.each(textFields)(
    'should truncate %s when too long instead of rejecting it',
    (field, maxLength) => {
      const value = faker.string.alpha({ length: maxLength + 1 });
      const declared = declaredAttributionBuilder().with(field, value).build();

      const result = DeclaredAttributionSchema.safeParse(declared);

      expect(result.success && result.data[field]).toBe(
        value.slice(0, maxLength),
      );
    },
  );

  it.each(textFields)(
    'should default %s to null when not a string instead of rejecting it',
    (field) => {
      const declared = declaredAttributionBuilder().build();

      const result = DeclaredAttributionSchema.safeParse({
        ...declared,
        [field]: faker.number.int(),
      });

      expect(result.success && result.data[field]).toBe(null);
    },
  );

  it.each([
    0,
    -faker.number.int({ min: 1 }),
    faker.number.int({ min: 1, max: 1_000 }) + 0.5,
    faker.string.numeric({ length: 3 }),
  ])(
    'should default an appId of %j to null instead of rejecting it',
    (appId) => {
      const declared = declaredAttributionBuilder().build();

      const result = DeclaredAttributionSchema.safeParse({
        ...declared,
        appId,
      });

      expect(result.success && result.data.appId).toBe(null);
    },
  );

  it('should count an emoji as one character and keep it whole', () => {
    const prefix = faker.string.alpha({
      length: DECLARED_APP_NAME_MAX_LENGTH - 1,
    });
    const emoji = String.fromCodePoint(0x1f600);
    const declared = declaredAttributionBuilder()
      .with('appName', `${prefix}${emoji}${faker.string.alpha()}`)
      .build();

    const result = DeclaredAttributionSchema.safeParse(declared);

    expect(result.success && result.data.appName).toBe(`${prefix}${emoji}`);
    expect(result.success && result.data.appName?.isWellFormed()).toBe(true);
  });

  it('should strip NUL characters', () => {
    const start = faker.string.alpha({ length: { min: 1, max: 10 } });
    const end = faker.string.alpha({ length: { min: 1, max: 10 } });
    const declared = declaredAttributionBuilder()
      .with('appName', `${start}\u0000${end}`)
      .build();

    const result = DeclaredAttributionSchema.safeParse(declared);

    expect(result.success && result.data.appName).toBe(`${start}${end}`);
  });
});
