import { safeAppAccessControlBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app-access-control.builder';
import { safeAppProviderBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app-provider.builder';
import { safeAppSocialProfileBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app-social-profile.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import { SafeAppAccessControlPolicies } from '@/domain/safe-apps/entities/safe-app-access-control.entity';
import { SafeAppSchema } from '@/domain/safe-apps/entities/schemas/safe-app.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('SafeAppSchema', () => {
  it('should validate a valid SafeApp', () => {
    const safeApp = safeAppBuilder().build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(result.success).toBe(true);
  });

  it('should allow a SafeApp with undefined iconUrl, provider and developerWebsite', () => {
    const fields = ['iconUrl', 'provider', 'developerWebsite'];
    const safeApp = safeAppBuilder().build();
    for (const field of fields) {
      // @ts-expect-error - inferred type doesn't allow optional properties
      delete safeApp[field];
    }

    const result = SafeAppSchema.safeParse(safeApp);

    expect(result.success && result.data.iconUrl).toBe(null);
    expect(result.success && result.data.provider).toBe(null);
    expect(result.success && result.data.developerWebsite).toBe(null);
  });

  it('should validate url, iconUrl and developerWebsite urls', () => {
    const safeApp = safeAppBuilder()
      .with('url', faker.string.alphanumeric())
      .with('iconUrl', faker.string.alphanumeric())
      .with('developerWebsite', faker.string.alphanumeric())
      .build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          validation: 'url',
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['url'],
        },
        {
          validation: 'url',
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['iconUrl'],
        },
        {
          validation: 'url',
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['developerWebsite'],
        },
      ]),
    );
  });

  it('should validate nested socialProfile and provider urls', () => {
    const safeApp = safeAppBuilder()
      .with('socialProfiles', [
        safeAppSocialProfileBuilder().build(),
        safeAppSocialProfileBuilder()
          .with('url', faker.string.alphanumeric())
          .build(),
      ])
      .with(
        'provider',
        safeAppProviderBuilder()
          .with('url', faker.string.alphanumeric())
          .build(),
      )
      .build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          validation: 'url',
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['socialProfiles', 1, 'url'],
        },
        {
          validation: 'url',
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['provider', 'url'],
        },
      ]),
    );
  });

  it('should validate accessControl field', () => {
    const safeApp = safeAppBuilder()
      .with(
        'accessControl',
        safeAppAccessControlBuilder()
          .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
          .with('value', [faker.internet.url()])
          .build(),
      )
      .build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(result.success).toBe(true);
  });

  it('should validate the url field on a SafeAppAccessControlPolicies.DomainAllowList accessControl', () => {
    const safeApp = safeAppBuilder()
      .with(
        'accessControl',
        safeAppAccessControlBuilder()
          .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
          .with('value', [faker.string.alphanumeric()])
          .build(),
      )
      .build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          validation: 'url',
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['accessControl', 'value', 0],
        },
      ]),
    );
  });

  it('should validate a SafeAppAccessControlPolicies.NoRestrictions accessControl', () => {
    const safeApp = safeAppBuilder()
      .with(
        'accessControl',
        safeAppAccessControlBuilder()
          .with('type', SafeAppAccessControlPolicies.NoRestrictions)
          .with('value', null)
          .build(),
      )
      .build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(result.success).toBe(true);
  });

  it('should validate a SafeAppAccessControlPolicies.Unknown accessControl', () => {
    const safeApp = safeAppBuilder()
      .with(
        'accessControl',
        safeAppAccessControlBuilder()
          .with('type', SafeAppAccessControlPolicies.Unknown)
          .with('value', null)
          .build(),
      )
      .build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(result.success).toBe(true);
  });

  it('should not validate an invalid SafeApp', () => {
    const safeApp = { invalid: 'safeApp' };

    const result = SafeAppSchema.safeParse(safeApp);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['id'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['url'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['name'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['description'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'array',
          received: 'undefined',
          path: ['chainIds'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'object',
          received: 'undefined',
          path: ['accessControl'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'array',
          received: 'undefined',
          path: ['tags'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'array',
          received: 'undefined',
          path: ['features'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'array',
          received: 'undefined',
          path: ['socialProfiles'],
          message: 'Required',
        },
      ]),
    );
  });
});
