// SPDX-License-Identifier: FSL-1.1-MIT
import type { CookieOptions } from 'express';

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
