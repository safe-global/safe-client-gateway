import { safeAppAccessControlBuilder } from '@/modules/safe-apps/domain/entities/__tests__/safe-app-access-control.builder';
import { safeAppProviderBuilder } from '@/modules/safe-apps/domain/entities/__tests__/safe-app-provider.builder';
import { safeAppSocialProfileBuilder } from '@/modules/safe-apps/domain/entities/__tests__/safe-app-social-profile.builder';
import { safeAppBuilder } from '@/modules/safe-apps/domain/entities/__tests__/safe-app.builder';
import { SafeAppAccessControlPolicies } from '@/modules/safe-apps/domain/entities/safe-app-access-control.entity';
import type { SafeAppSocialProfile } from '@/modules/safe-apps/domain/entities/safe-app-social-profile.entity';
import { SafeAppSchema } from '@/modules/safe-apps/domain/entities/schemas/safe-app.schema';
import { faker } from '@faker-js/faker';

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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_format',
        format: 'url',
        message: 'Invalid URL',
        path: ['url'],
      }),
      expect.objectContaining({
        code: 'invalid_format',
        format: 'url',
        message: 'Invalid URL',
        path: ['iconUrl'],
      }),
      expect.objectContaining({
        code: 'invalid_format',
        format: 'url',
        message: 'Invalid URL',
        path: ['developerWebsite'],
      }),
    ]);
  });

  it('should throw if a socialProfile has an invalid url', () => {
    const safeApp = safeAppBuilder()
      .with('socialProfiles', [
        safeAppSocialProfileBuilder()
          .with('url', faker.string.alphanumeric())
          .build(),
      ])
      .build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_format',
        format: 'url',
        message: 'Invalid URL',
        path: ['socialProfiles', 0, 'url'],
      }),
    ]);
  });

  it('should throw if a profile has an invalid url', () => {
    const safeApp = safeAppBuilder()
      .with(
        'provider',
        safeAppProviderBuilder()
          .with('url', faker.string.alphanumeric())
          .build(),
      )
      .build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_format',
        format: 'url',
        message: 'Invalid URL',
        path: ['provider', 'url'],
      }),
    ]);
  });

  it('should fallback to UNKNOWN nested socialProfile', () => {
    const safeApp = safeAppBuilder()
      .with('socialProfiles', [
        safeAppSocialProfileBuilder()
          .with('platform', 'invalid' as SafeAppSocialProfile['platform'])
          .build(),
      ])
      .build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(result.success && result.data.socialProfiles[0].platform).toBe(
      'UNKNOWN',
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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_format',
        format: 'url',
        message: 'Invalid URL',
        path: ['accessControl', 'value', 0],
      }),
    ]);
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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'number',
        path: ['id'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'string',
        path: ['url'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'string',
        path: ['name'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'string',
        path: ['description'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'array',
        path: ['chainIds'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'object',
        path: ['accessControl'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'array',
        path: ['tags'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'array',
        path: ['features'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'array',
        path: ['socialProfiles'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'boolean',
        path: ['featured'],
      }),
    ]);
  });
});
