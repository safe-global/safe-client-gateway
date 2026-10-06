// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getProtectedResourceMetadataUrl } from '@/modules/auth/mcp/routes/utils/protected-resource-metadata.utils';

describe('getProtectedResourceMetadataUrl', () => {
  const origin = faker.internet.url({ appendSlash: false });

  it('should insert the well-known path before the resource path', () => {
    expect(getProtectedResourceMetadataUrl(`${origin}/v1/mcp`)).toBe(
      `${origin}/.well-known/oauth-protected-resource/v1/mcp`,
    );
  });

  it('should ignore a trailing slash', () => {
    expect(getProtectedResourceMetadataUrl(`${origin}/v1/mcp/`)).toBe(
      `${origin}/.well-known/oauth-protected-resource/v1/mcp`,
    );
  });

  it('should use the well-known root for a resource at the origin', () => {
    expect(getProtectedResourceMetadataUrl(`${origin}/`)).toBe(
      `${origin}/.well-known/oauth-protected-resource`,
    );
  });
});
