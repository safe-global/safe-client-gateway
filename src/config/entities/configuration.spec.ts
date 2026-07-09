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

describe('configuration - features.zerionEnabled', () => {
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

    expect(configuration().features.zerionEnabled).toBe(false);
  });

  it.each(['true', 'TRUE', 'True'])('is enabled when set to %s', (value) => {
    process.env[ENV_KEY] = value;

    expect(configuration().features.zerionEnabled).toBe(true);
  });

  it.each(['false', '0', '1,10,137'])('is disabled when set to %s', (value) => {
    process.env[ENV_KEY] = value;

    expect(configuration().features.zerionEnabled).toBe(false);
  });
});
