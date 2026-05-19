// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  type EmailAddress,
  EmailAddressSchema,
} from '@/validation/entities/schemas/email-address.schema';

describe('EmailAddressSchema', () => {
  it('should validate a lowercase email and return it unchanged', () => {
    const value = faker.internet.email().toLowerCase();

    const result = EmailAddressSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should lowercase a mixed-case email', () => {
    const value = `${faker.internet.username()}@EXAMPLE.COM`;

    const result = EmailAddressSchema.safeParse(value);

    expect(result.success && result.data).toBe(value.toLowerCase());
  });

  it('should reject a non-email string', () => {
    const result = EmailAddressSchema.safeParse('not-an-email');

    expect(result.success).toBe(false);
  });

  it('should reject an email exceeding the max length', () => {
    const oversized = `${'a'.repeat(251)}@b.co`; // 256 chars

    const result = EmailAddressSchema.safeParse(oversized);

    expect(result.success).toBe(false);
  });

  it('should brand the inferred type so plain strings are not assignable', () => {
    const parsed = EmailAddressSchema.parse('user@example.com');
    // The branded value flows freely.
    const _branded: EmailAddress = parsed;

    // A plain string is not assignable to EmailAddress: this @ts-expect-error
    // fails the build if the schema ever loses its `.brand<'EmailAddress'>()`.
    // @ts-expect-error: plain string must not be assignable to EmailAddress
    const _plain: EmailAddress = 'user@example.com';

    // Runtime assertions only exist to keep the bindings used; the real test
    // is the @ts-expect-error directive above.
    expect(_branded).toBe('user@example.com');
    expect(_plain).toBe('user@example.com');
  });
});
