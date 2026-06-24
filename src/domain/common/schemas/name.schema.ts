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

// Codepoint length, so multi-byte characters (e.g. emoji, CJK) count as one.
const getNameLength = (name: string): number => [...name].length;

export const makeNameSchema = (args?: {
  minLength?: number;
  maxLength?: number;
}): z.ZodType<string> => {
  const min = args?.minLength ?? NAME_MIN_LENGTH;
  const max = args?.maxLength ?? NAME_MAX_LENGTH;

  // Single superRefine so all rules live in one place and the codepoint length
  // is computed once. Each branch returns after adding an issue, preserving the
  // prior refine-chain behavior of reporting only the first failure.
  return z
    .string()
    .transform(sanitizeName)
    .superRefine((name, ctx) => {
      if (name.length === 0) {
        if (min > 0) {
          ctx.addIssue({
            code: 'custom',
            message: EMPTY_NAME_MESSAGE,
          });
        }
        return;
      }

      if (!ALLOWED_NAME_REGEX.test(name)) {
        ctx.addIssue({
          code: 'custom',
          message: DISALLOWED_CHARACTER_MESSAGE,
        });
        return;
      }

      const length = getNameLength(name);

      if (length < min) {
        ctx.addIssue({
          code: 'custom',
          message: `Names must be at least ${min} character(s) long`,
        });
        return;
      }

      if (length > max) {
        ctx.addIssue({
          code: 'custom',
          message: `Names must be at most ${max} characters long`,
        });
      }
    });
};

export const NameSchema = makeNameSchema();
