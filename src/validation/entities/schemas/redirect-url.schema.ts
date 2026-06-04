// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

function hasControlChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0x00 && code <= 0x1f) || code === 0x7f) {
      return true;
    }
  }
  return false;
}

export const RedirectUrlSchema = z
  .string()
  .max(2048, 'redirect_url exceeds max length')
  .refine((val) => !hasControlChars(val), {
    message: 'redirect_url contains invalid characters',
  })
  .optional();
