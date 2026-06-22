// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 30;

// Unicode control (Cc) + format (Cf): C0/C1 controls, bidirectional overrides
// (Trojan Source / CVE-2021-42574), and zero-width characters. ZWJ (U+200D) and
// ZWNJ (U+200C) are re-allowed for emoji sequences and Indic/Arabic joiners.
const ZWJ = '‍';
const ZWNJ = '‌';
const isDisallowed = (ch: string): boolean =>
  /[\p{Cc}\p{Cf}]/u.test(ch) && ch !== ZWJ && ch !== ZWNJ;

export const sanitizeName = (value: string): string =>
  [...value.normalize('NFC')]
    .filter((ch) => !isDisallowed(ch))
    .join('')
    .trim();

export const makeNameSchema = (args?: {
  minLength?: number;
  maxLength?: number;
}): z.ZodType<string> => {
  const min = args?.minLength ?? NAME_MIN_LENGTH;
  const max = args?.maxLength ?? NAME_MAX_LENGTH;
  return z
    .string()
    .transform(sanitizeName)
    .refine((s) => [...s].length >= min, {
      message: `Names must be at least ${min} character(s) long`,
    })
    .refine((s) => [...s].length <= max, {
      message: `Names must be at most ${max} characters long`,
    });
};

export const NameSchema = makeNameSchema();
