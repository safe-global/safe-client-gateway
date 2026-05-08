// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ResendInviteDtoSchema } from '@/modules/spaces/routes/entities/resend-invite.dto.entity';

describe('ResendInviteDtoSchema', () => {
  it('should accept an address-only payload', () => {
    const result = ResendInviteDtoSchema.safeParse({
      address: getAddress(faker.finance.ethereumAddress()),
    });

    expect(result.success).toBe(true);
  });

  it('should accept an email-only payload', () => {
    const result = ResendInviteDtoSchema.safeParse({
      email: faker.internet.email().toLowerCase(),
    });

    expect(result.success).toBe(true);
  });

  it('should reject a payload that has both address and email', () => {
    const result = ResendInviteDtoSchema.safeParse({
      address: getAddress(faker.finance.ethereumAddress()),
      email: faker.internet.email().toLowerCase(),
    });

    expect(result.success).toBe(false);
  });

  it('should reject an empty payload', () => {
    const result = ResendInviteDtoSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('should reject a non-address string in the address branch', () => {
    const result = ResendInviteDtoSchema.safeParse({
      address: 'not-an-address',
    });

    expect(result.success).toBe(false);
  });

  it('should reject a malformed email', () => {
    const result = ResendInviteDtoSchema.safeParse({ email: 'not-an-email' });

    expect(result.success).toBe(false);
  });

  it('should reject an email longer than 255 characters', () => {
    const localPart = 'a'.repeat(250);
    const result = ResendInviteDtoSchema.safeParse({
      email: `${localPart}@example.com`,
    });

    expect(result.success).toBe(false);
  });
});
