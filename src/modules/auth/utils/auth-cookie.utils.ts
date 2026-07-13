// SPDX-License-Identifier: FSL-1.1-MIT

export type CookieOptions = {
  httpOnly: boolean;
  maxAge?: number;
  expires?: Date;
  path: string;
  sameSite: 'lax' | 'none';
  secure: boolean;
};

export const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
export const ACCESS_TOKEN_COOKIE_SAME_SITE_LAX = 'lax';
export const ACCESS_TOKEN_COOKIE_SAME_SITE_NONE = 'none';

export function getCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: isProduction
      ? ACCESS_TOKEN_COOKIE_SAME_SITE_LAX
      : ACCESS_TOKEN_COOKIE_SAME_SITE_NONE,
    path: '/',
  };
}

/**
 * Builds the options for an expiring cookie.
 *
 * Express derived the `Expires` attribute from `maxAge`, but `@fastify/cookie`
 * only emits `Max-Age`. We add `expires` explicitly so the `Set-Cookie` header
 * keeps both attributes, preserving the pre-Fastify contract.
 *
 * @param isProduction - whether the app runs in production
 * @param maxAge - cookie lifetime in seconds, or `undefined` for a session cookie
 */
export function getSetCookieOptions(
  isProduction: boolean,
  maxAge: number | undefined,
): CookieOptions {
  const options = getCookieOptions(isProduction);
  if (maxAge === undefined) {
    return options;
  }
  return {
    ...options,
    maxAge,
    expires: new Date(Date.now() + maxAge * 1_000),
  };
}

/**
 * Builds the options for clearing a cookie.
 *
 * Express's `clearCookie` emitted only an epoch `Expires`, whereas
 * `@fastify/cookie`'s `clearCookie` also forces `Max-Age=0`. Clearing through
 * `setCookie(name, '', ...)` with these options keeps the original contract.
 *
 * @param isProduction - whether the app runs in production
 */
export function getClearCookieOptions(isProduction: boolean): CookieOptions {
  return {
    ...getCookieOptions(isProduction),
    expires: new Date(0),
  };
}
