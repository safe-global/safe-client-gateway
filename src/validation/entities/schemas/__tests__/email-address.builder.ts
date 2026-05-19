// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  type EmailAddress,
  EmailAddressSchema,
} from '@/validation/entities/schemas/email-address.schema';

export const fakeEmailAddress = (): EmailAddress =>
  EmailAddressSchema.parse(faker.internet.email());
