// SPDX-License-Identifier: FSL-1.1-MIT
import configuration from '@/config/entities/configuration';

describe('configuration - express.trustProxy', () => {
  const ENV_KEY = 'EXPRESS_TRUST_PROXY';
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it('defaults to internal subnets when unset', () => {
    delete process.env[ENV_KEY];

    expect(configuration().express.trustProxy).toBe('loopback, uniquelocal');
  });

  it('falls back to the default when set to an empty string', () => {
    // An empty value must fall back to the default, not disable trust.
    process.env[ENV_KEY] = '';

    expect(configuration().express.trustProxy).toBe('loopback, uniquelocal');
  });

  it('uses the provided value when set', () => {
    process.env[ENV_KEY] = '10.0.0.0/8';

    expect(configuration().express.trustProxy).toBe('10.0.0.0/8');
  });
});

describe('configuration - features.zerion', () => {
  const ENV_KEY = 'FF_ZERION_ENABLED';
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it('defaults to false when unset', () => {
    delete process.env[ENV_KEY];

    expect(configuration().features.zerion).toBe(false);
  });

  it.each(['true', 'TRUE', 'True'])('is enabled when set to %s', (value) => {
    process.env[ENV_KEY] = value;

    expect(configuration().features.zerion).toBe(true);
  });

  it.each(['false', '0', '1,10,137'])('is disabled when set to %s', (value) => {
    process.env[ENV_KEY] = value;

    expect(configuration().features.zerion).toBe(false);
  });
});

describe('configuration - entitlements.enforcementStartsAt', () => {
  const ENV_KEY = 'ENTITLEMENTS_ENFORCEMENT_STARTS_AT';
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it('defaults far into the future when unset', () => {
    delete process.env[ENV_KEY];

    expect(configuration().entitlements.enforcementStartsAt).toStrictEqual(
      new Date('2099-01-01T00:00:00Z'),
    );
  });

  it('parses the provided value into a Date', () => {
    process.env[ENV_KEY] = '2026-10-01T00:00:00Z';

    expect(configuration().entitlements.enforcementStartsAt).toStrictEqual(
      new Date('2026-10-01T00:00:00Z'),
    );
  });

  // An Invalid Date would silently disable enforcement and offer the legacy
  // grace to every workspace, so both failure directions are permissive.
  it.each(['the first of october', '2026-13-45T00:00:00Z', ''])(
    'throws when set to %s',
    (value) => {
      process.env[ENV_KEY] = value;

      expect(() => configuration()).toThrow(
        'ENTITLEMENTS_ENFORCEMENT_STARTS_AT is not a valid date',
      );
    },
  );
});
