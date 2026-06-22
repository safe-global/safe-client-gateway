// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 30;

// Invisible control (Cc) + format (Cf) chars, stripped silently. Includes
// ZWJ/ZWNJ — dropped for safety, at the cost of shaping in some Persian/Indic names.
const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;

// Auto-inserted smart punctuation folded to its ASCII equivalent (e.g. "O’Brien").
const SMART_PUNCTUATION: ReadonlyArray<[RegExp, string]> = [
  [/[‘’‚‛′]/gu, "'"],
  [/[–—−]/gu, '-'],
];

// Punctuation allowed alongside letters/marks/numbers/spaces; excludes chars
// dangerous downstream (= + * / < > " $ { }).
const ALLOWED_PUNCTUATION = " ._\\-#@&',()";

const ALLOWED_NAME_REGEX = new RegExp(
  `^[\\p{L}\\p{M}\\p{N}${ALLOWED_PUNCTUATION}]*$`,
  'u',
);

export const DISALLOWED_CHARACTER_MESSAGE =
  "Names can only contain letters, numbers, spaces and the characters . _ - # @ & ' , ( )";

export const EMPTY_NAME_MESSAGE = 'Names cannot be empty';

export const sanitizeName = (value: string): string => {
  let result = value.normalize('NFC').replace(INVISIBLE_CHARACTERS, '');
  for (const [pattern, replacement] of SMART_PUNCTUATION) {
    result = result.replace(pattern, replacement);
  }
  return result.trim();
};

export const makeNameSchema = (args?: {
  minLength?: number;
  maxLength?: number;
}): z.ZodType<string> => {
  const min = args?.minLength ?? NAME_MIN_LENGTH;
  const max = args?.maxLength ?? NAME_MAX_LENGTH;
  return (
    z
      .string()
      .transform(sanitizeName)
      .refine((s) => s.length > 0 || min === 0, {
        message: EMPTY_NAME_MESSAGE,
      })
      .refine((s) => ALLOWED_NAME_REGEX.test(s), {
        message: DISALLOWED_CHARACTER_MESSAGE,
      })
      // Skip empty (already reported above) so a blank name yields one message.
      .refine((s) => s.length === 0 || [...s].length >= min, {
        message: `Names must be at least ${min} character(s) long`,
      })
      .refine((s) => [...s].length <= max, {
        message: `Names must be at most ${max} characters long`,
      })
  );
};

export const NameSchema = makeNameSchema();
