// SPDX-License-Identifier: FSL-1.1-MIT
import configuration from '@/config/entities/configuration';

describe('configuration', () => {
  const originalAuth0Scope = process.env.AUTH0_SCOPE;

  afterEach(() => {
    process.env.AUTH0_SCOPE = originalAuth0Scope;
  });

  it('should default AUTH0_SCOPE to openid email', () => {
    delete process.env.AUTH0_SCOPE;

    const result = configuration();

    expect(result.auth.auth0.scope).toBe('openid email');
  });
});
