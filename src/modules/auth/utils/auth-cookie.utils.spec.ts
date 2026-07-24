// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  getClearCookieOptions,
  getCookieOptions,
  getSetCookieOptions,
} from '@/modules/auth/utils/auth-cookie.utils';

describe('auth-cookie.utils', () => {
  describe('getCookieOptions', () => {
    it('uses SameSite=Lax in production', () => {
      expect(getCookieOptions(true)).toStrictEqual({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
    });

    it('uses SameSite=None outside production', () => {
      expect(getCookieOptions(false)).toStrictEqual({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      });
    });
  });

  describe('getSetCookieOptions', () => {
    it('returns a session cookie (no Max-Age/Expires) when maxAge is undefined', () => {
      const options = getSetCookieOptions(true, undefined);

      expect(options).toStrictEqual(getCookieOptions(true));
      expect(options.maxAge).toBeUndefined();
      expect(options.expires).toBeUndefined();
    });

    it('treats maxAge as seconds and derives Expires in milliseconds', () => {
      // Regression guard: maxAge must be passed through unchanged (seconds),
      // while Expires is maxAge converted to milliseconds from "now".
      const maxAge = faker.number.int({ min: 60, max: 3_600 });

      const before = Date.now();
      const options = getSetCookieOptions(true, maxAge);
      const after = Date.now();

      expect(options.maxAge).toBe(maxAge);
      expect(options.expires).toBeInstanceOf(Date);
      const expiresMs = options.expires!.getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + maxAge * 1_000);
      expect(expiresMs).toBeLessThanOrEqual(after + maxAge * 1_000);
    });

    it('keeps the production SameSite flag', () => {
      expect(getSetCookieOptions(false, 60).sameSite).toBe('none');
      expect(getSetCookieOptions(true, 60).sameSite).toBe('lax');
    });
  });

  describe('getClearCookieOptions', () => {
    it('expires at the epoch and sets no Max-Age', () => {
      const options = getClearCookieOptions(true);

      expect(options.maxAge).toBeUndefined();
      expect(options.expires).toStrictEqual(new Date(0));
      expect(options).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
    });

    it('keeps the non-production SameSite flag', () => {
      expect(getClearCookieOptions(false).sameSite).toBe('none');
    });
  });
});
