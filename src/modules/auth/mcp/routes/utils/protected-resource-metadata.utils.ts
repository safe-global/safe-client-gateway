// SPDX-License-Identifier: FSL-1.1-MIT

// https://datatracker.ietf.org/doc/html/rfc9728#section-3
export const PROTECTED_RESOURCE_METADATA_PATH =
  '/.well-known/oauth-protected-resource';

/**
 * Where the metadata of the resource at {@link resourceUrl} is published: the
 * well-known path inserted between the origin and the resource's own path.
 */
export function getProtectedResourceMetadataUrl(resourceUrl: string): string {
  const url = new URL(resourceUrl);
  const resourcePath = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${PROTECTED_RESOURCE_METADATA_PATH}${resourcePath}`;
}
