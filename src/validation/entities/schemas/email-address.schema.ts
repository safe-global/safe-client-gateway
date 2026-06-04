// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

const EMAIL_ADDRESS_MAX_LENGTH = 255;

export const EmailAddressSchema = z
  .email()
  .toLowerCase()
  .max(EMAIL_ADDRESS_MAX_LENGTH)
  .brand<'EmailAddress'>();

export type EmailAddress = z.infer<typeof EmailAddressSchema>;
