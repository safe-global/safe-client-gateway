// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { SpaceAuditEventSchema } from '#/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ExperimentalFeatures } from '#/modules/spaces/domain/entities/experimental-feature.entity';

describe('SpaceAuditEventSchema — plaintext addresses', () => {
  const ciphertext = 'kms:v1:abcDEF012_-';
  const plaintext = getAddress(faker.finance.ethereumAddress());

  it.each(['SAFE_ADDED', 'SAFE_REMOVED'] as const)(
    'accepts a plaintext address in a %s payload',
    (eventType) => {
      const result = SpaceAuditEventSchema.safeParse({
        eventType,
        payload: { safes: [{ chainId: '1', address: plaintext }] },
      });
      expect(result.success).toBe(true);
    },
  );

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

  it('accepts plaintext addresses in an ADDRESS_BOOK_REQUEST_CREATED payload', () => {
    const result = SpaceAuditEventSchema.safeParse({
      eventType: 'ADDRESS_BOOK_REQUEST_CREATED',
      payload: {
        address: plaintext,
        name: faker.person.fullName(),
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts plaintext addresses in an ADDRESS_BOOK_REQUEST_REJECTED payload', () => {
    const result = SpaceAuditEventSchema.safeParse({
      eventType: 'ADDRESS_BOOK_REQUEST_REJECTED',
      payload: {
        address: plaintext,
        name: faker.person.fullName(),
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('SpaceAuditEventSchema — SPACE_UPDATED experimentalFeatures', () => {
  it('does not inject experimentalFeatures into a name-only update', () => {
    const payload = {
      old: { name: faker.lorem.words() },
      new: { name: faker.lorem.words() },
    };

    const result = SpaceAuditEventSchema.parse({
      eventType: 'SPACE_UPDATED',
      payload,
    });

    expect(result.payload).toStrictEqual(payload);
  });

  it('round-trips an experimentalFeatures change', () => {
    const features = [faker.helpers.arrayElement(ExperimentalFeatures)];
    const payload = {
      old: { experimentalFeatures: [] },
      new: { experimentalFeatures: features },
    };

    const result = SpaceAuditEventSchema.parse({
      eventType: 'SPACE_UPDATED',
      payload,
    });

    expect(result.payload).toStrictEqual(payload);
  });

  it('accepts a feature key no longer in the enum', () => {
    const result = SpaceAuditEventSchema.safeParse({
      eventType: 'SPACE_UPDATED',
      payload: {
        old: { experimentalFeatures: [faker.word.noun()] },
        new: { experimentalFeatures: [] },
      },
    });

    expect(result.success).toBe(true);
  });
});
