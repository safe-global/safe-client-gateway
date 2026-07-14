// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { SpaceAuditEventSchema } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';

describe('SpaceAuditEventSchema — plaintext addresses', () => {
  const ciphertext = 'kms:v1:abcDEF012_-';
  const plaintext = getAddress(faker.finance.ethereumAddress());

  it.each([
    'SAFE_ADDED',
    'SAFE_REMOVED',
  ] as const)('accepts a plaintext address in a %s payload', (eventType) => {
    const result = SpaceAuditEventSchema.safeParse({
      eventType,
      payload: { safes: [{ chainId: '1', address: plaintext }] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a ciphertext address in a SAFE_ADDED payload (payloads carry plaintext)', () => {
    const result = SpaceAuditEventSchema.safeParse({
      eventType: 'SAFE_ADDED',
      payload: { safes: [{ chainId: '1', address: ciphertext }] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a string that is not an address', () => {
    const result = SpaceAuditEventSchema.safeParse({
      eventType: 'SAFE_ADDED',
      payload: { safes: [{ chainId: '1', address: 'not-an-address' }] },
    });
    expect(result.success).toBe(false);
  });

  it('accepts plaintext addresses in an ADDRESS_BOOK_UPSERTED payload', () => {
    const result = SpaceAuditEventSchema.safeParse({
      eventType: 'ADDRESS_BOOK_UPSERTED',
      payload: {
        created: [{ address: plaintext, name: faker.person.fullName() }],
        updated: [],
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a plaintext address in an ADDRESS_BOOK_DELETED payload', () => {
    const result = SpaceAuditEventSchema.safeParse({
      eventType: 'ADDRESS_BOOK_DELETED',
      payload: { address: plaintext, name: faker.person.fullName() },
    });
    expect(result.success).toBe(true);
  });
});
