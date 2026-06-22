// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 30;

// Invisible control (Cc) + format (Cf) chars (e.g. bidi overrides, zero-width
// spaces, joiners). Stripped silently so copy-pasted names still succeed.
const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;

// Punctuation allowed alongside letters/marks/numbers/spaces. Covers real-world
// names ("Contact #1", "maria@web.com", "O'Brien") while excluding chars that
// are dangerous downstream (formulas = + * /, markup < > ", templating $ { }).
const ALLOWED_PUNCTUATION = " ._\\-#@&',()";

const ALLOWED_NAME_REGEX = new RegExp(
  `^[\\p{L}\\p{M}\\p{N}${ALLOWED_PUNCTUATION}]*$`,
  'u',
);

export const DISALLOWED_CHARACTER_MESSAGE =
  "Names can only contain letters, numbers, spaces and the characters . _ - # @ & ' , ( )";

export const sanitizeName = (value: string): string =>
  value.normalize('NFC').replace(INVISIBLE_CHARACTERS, '').trim();

export const makeNameSchema = (args?: {
  minLength?: number;
  maxLength?: number;
}): z.ZodType<string> => {
  const min = args?.minLength ?? NAME_MIN_LENGTH;
  const max = args?.maxLength ?? NAME_MAX_LENGTH;
  return z
    .string()
    .transform(sanitizeName)
    .refine((s) => ALLOWED_NAME_REGEX.test(s), {
      message: DISALLOWED_CHARACTER_MESSAGE,
    })
    .refine((s) => [...s].length >= min, {
      message: `Names must be at least ${min} character(s) long`,
    })
    .refine((s) => [...s].length <= max, {
      message: `Names must be at most ${max} characters long`,
    });
};

export const NameSchema = makeNameSchema();
