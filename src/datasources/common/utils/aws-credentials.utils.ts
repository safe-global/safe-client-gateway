// SPDX-License-Identifier: FSL-1.1-MIT

import { fromTokenFile } from '@aws-sdk/credential-provider-web-identity';

/**
 * Resolves AWS SDK credentials for clients that support IRSA.
 *
 * In EKS, IRSA provides pod credentials via a projected web identity token
 * file. When `webIdentityTokenFile` is set, returns web identity credentials;
 * otherwise returns `undefined` so the client falls back to the default AWS
 * provider chain (env keys, shared profile, SSO) — or to an explicit fallback
 * chained with `??` at the call site.
 */
export function resolveAwsCredentials(
  webIdentityTokenFile: string | undefined,
): ReturnType<typeof fromTokenFile> | undefined {
  return webIdentityTokenFile
    ? fromTokenFile({ webIdentityTokenFile })
    : undefined;
}
