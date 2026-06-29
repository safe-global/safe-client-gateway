// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Cookie holding the short-lived TOTP elevation token. Shared between the
 * controller (which sets it) and the guard (which reads it).
 */
export const TOTP_TOKEN_COOKIE_NAME = 'totp_token';
