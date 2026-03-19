import { z } from 'zod';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_REGEX = /[\x00-\x1f\x7f]/;

export const RedirectUrlSchema = z
  .string()
  .max(2048, 'redirect_url exceeds max length')
  .refine((val) => !CONTROL_CHARS_REGEX.test(val), {
    message: 'redirect_url contains invalid characters',
  })
  .optional();
