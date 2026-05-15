// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const EMAIL_ADDRESS_MAX_LENGTH = 255;

export type EmailAddress = string & { readonly __brand: 'EmailAddress' };

export const EmailAddressSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z.email({ error: 'Invalid email address' }).max(EMAIL_ADDRESS_MAX_LENGTH),
  )
  .transform((value) => value as EmailAddress);
