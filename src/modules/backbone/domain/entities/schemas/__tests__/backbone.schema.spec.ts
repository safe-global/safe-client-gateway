import { backboneBuilder } from '@/modules/backbone/domain/entities/__tests__/backbone.builder';
import { BackboneSchema } from '@/modules/backbone/domain/entities/schemas/backbone.schema';

describe('BackboneSchema', () => {
  it('should validate a valid backbone', () => {
    const backbone = backboneBuilder().build();

    const result = BackboneSchema.safeParse(backbone);

    expect(result.success).toBe(true);
  });

  it('should allow null headers and default to null', () => {
    const backbone = backboneBuilder().with('headers', null).build();

    const result = BackboneSchema.safeParse(backbone);

    expect(result.success && result.data.headers).toBe(null);
  });

  it('should allow optional headers and default to null', () => {
    const backbone = backboneBuilder().build();
    // @ts-expect-error - inferred type takes default into account
    delete backbone.headers;

    const result = BackboneSchema.safeParse(backbone);

    expect(result.success && result.data.headers).toBe(null);
  });

  it('should allow null settings and default to null', () => {
    const backbone = backboneBuilder().with('settings', null).build();

    const result = BackboneSchema.safeParse(backbone);

    expect(result.success && result.data.settings).toBe(null);
  });

  it('should allow optional settings and default to null', () => {
    const backbone = backboneBuilder().build();
    // @ts-expect-error - inferred type takes default into account
    delete backbone.settings;

    const result = BackboneSchema.safeParse(backbone);

    expect(result.success && result.data.settings).toBe(null);
  });

  it('should not validate an invalid backbone', () => {
    const backbone = { invalid: 'backbone' };

    const result = BackboneSchema.safeParse(backbone);

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
        path: ['version'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['api_version'],
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Invalid input: expected boolean, received undefined',
        path: ['secure'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['host'],
      },
    ]);
  });
});
