// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException } from '@nestjs/common';
import type { IConfigurationService } from '@/config/configuration.service.interface';

/**
 * Builds the Auth0 {@link https://auth0.com/docs/api/authentication/logout/auth-0-logout}
 * base URL from {@link IConfigurationService}.
 *
 * Reads `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID`. Returns `null` when either value
 * is missing, empty, or the domain cannot be parsed into a valid HTTPS origin.
 *
 * The returned URL already contains the `client_id` query parameter; callers
 * only need to append `returnTo` before redirecting.
 *
 * @param configurationService - Application configuration service.
 * @returns The fully-qualified Auth0 logout base URL, or `null` if Auth0 is
 *   not configured.
 */
export function buildAuth0LogoutBaseUrl(
  configurationService: IConfigurationService,
): string | null {
  const key = 'auth.auth0';
  const domain = configurationService.get<string>(`${key}.domain`);
  const clientId = configurationService.get<string>(`${key}.clientId`);

  if (!domain || !clientId?.trim()) return null;

  try {
    const url = new URL('/v2/logout', `https://${domain}`);
    url.searchParams.set('client_id', clientId.trim());
    return url.toString();
  } catch {
    return null;
  }
}

export type RedirectConfig = {
  postLoginRedirectUri: string;
  allowedRedirectDomain?: string;
  isProduction: boolean;
};

/**
 * Reads redirect-related configuration values once and returns a
 * {@link RedirectConfig} snapshot. Call this in the service constructor
 * and pass the result to {@link resolveAndValidateRedirectUrl} on each
 * request — avoids re-reading config on every call.
 *
 * @param configurationService - Application configuration service.
 * @returns A frozen snapshot of the redirect-related config values.
 * @throws If `auth.postLoginRedirectUri` or `application.isProduction` are
 *   not set.
 */
export function getRedirectConfig(
  configurationService: IConfigurationService,
): RedirectConfig {
  return {
    postLoginRedirectUri: configurationService.getOrThrow<string>(
      'auth.postLoginRedirectUri',
    ),
    allowedRedirectDomain: configurationService.get<string>(
      'auth.allowedRedirectDomain',
    ),
    isProduction: configurationService.getOrThrow<boolean>(
      'application.isProduction',
    ),
  };
}

/**
 * Resolves and validates a caller-supplied redirect URL against the
 * pre-loaded {@link RedirectConfig}.
 *
 * - When {@link redirectUrl} is `undefined`, returns
 *   {@link RedirectConfig.postLoginRedirectUri} as-is.
 * - Otherwise, resolves {@link redirectUrl} against the post-login URI
 *   (supporting both absolute and relative paths) and validates the
 *   resulting hostname via {@link isAllowedRedirectUrl}.
 *
 * @param config - Pre-loaded redirect configuration (from {@link getRedirectConfig}).
 * @param redirectUrl - Optional redirect URL supplied by the client.
 * @returns The resolved absolute URL string.
 * @throws {BadRequestException} If the URL is malformed or targets a
 *   disallowed domain/origin.
 */
export function resolveAndValidateRedirectUrl(
  config: RedirectConfig,
  redirectUrl?: string,
): string {
  if (!redirectUrl) return config.postLoginRedirectUri;

  try {
    const target = new URL(redirectUrl, config.postLoginRedirectUri);
    if (!isAllowedRedirectUrl(target, config)) throw new Error();
    return target.toString();
  } catch {
    throw new BadRequestException(
      'Invalid redirect URL: must be properly formed and on an allowed domain',
    );
  }
}

/**
 * Checks whether {@link target} is an allowed redirect destination.
 *
 * **Production** — strict same-origin: the target's origin must exactly
 * match {@link RedirectConfig.postLoginRedirectUri}'s origin.
 *
 * **Non-production with {@link RedirectConfig.allowedRedirectDomain}** —
 * the target's hostname must equal or be a subdomain of the configured
 * domain. Additionally rejects:
 *
 * - Non-HTTPS schemes (prevents protocol downgrades).
 * - URLs with {@link URL.username} or {@link URL.password} (prevents
 *   credential-based open-redirect attacks, e.g.
 *   `https://attacker.com@allowed.dev`).
 * - URLs with an explicit {@link URL.port} (restricts redirects to
 *   standard HTTPS endpoints).
 *
 * @param target - The resolved redirect {@link URL} to validate.
 * @param config - Pre-loaded redirect configuration.
 * @returns `true` if the redirect target is allowed, `false` otherwise.
 */
function isAllowedRedirectUrl(target: URL, config: RedirectConfig): boolean {
  if (!config.isProduction && config.allowedRedirectDomain) {
    if (
      target.protocol !== 'https:' ||
      target.username ||
      target.password ||
      target.port
    ) {
      return false;
    }
    const suffix = `.${config.allowedRedirectDomain}`;
    return (
      target.hostname === config.allowedRedirectDomain ||
      target.hostname.endsWith(suffix)
    );
  }
  return target.origin === new URL(config.postLoginRedirectUri).origin;
}
