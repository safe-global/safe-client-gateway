// SPDX-License-Identifier: FSL-1.1-MIT

import type { IFieldEncryptionService } from '@/datasources/encryption/field-encryption.service.interface';
import {
  decryptAuditPayload,
  encryptAuditPayload,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.encryption';
import {
  type SpaceAuditEventPayload,
  SpaceAuditEventType,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';

// Reversible stand-in for the real service so we can assert exactly which
// fields were transformed.
const service: IFieldEncryptionService = {
  encrypt: (value: string) => `E:${value}`,
  encryptDeterministic: (value: string) => `E:${value}`,
  decrypt: (value: string) => value.replace(/^E:/, ''),
  isEncrypted: (value: string) => value.startsWith('E:'),
};

describe('audit payload encryption', () => {
  it('encrypts and decrypts SPACE_CREATED name', () => {
    const payload: SpaceAuditEventPayload = { name: 'My Space' };

    const encrypted = encryptAuditPayload(
      service,
      SpaceAuditEventType.SPACE_CREATED,
      payload,
    );

    expect(encrypted).toStrictEqual({ name: 'E:My Space' });
    expect(
      decryptAuditPayload(
        service,
        SpaceAuditEventType.SPACE_CREATED,
        encrypted,
      ),
    ).toStrictEqual(payload);
  });

  it('encrypts SPACE_DELETED name', () => {
    const encrypted = encryptAuditPayload(
      service,
      SpaceAuditEventType.SPACE_DELETED,
      { name: 'Gone' },
    );

    expect(encrypted).toStrictEqual({ name: 'E:Gone' });
  });

  it('encrypts only present name fields of SPACE_UPDATED', () => {
    const encrypted = encryptAuditPayload(
      service,
      SpaceAuditEventType.SPACE_UPDATED,
      { old: { name: 'Old', status: 'ACTIVE' }, new: { status: 'ACTIVE' } },
    );

    expect(encrypted).toStrictEqual({
      old: { name: 'E:Old', status: 'ACTIVE' },
      new: { status: 'ACTIVE' },
    });
  });

  it('encrypts every entry name in ADDRESS_BOOK_UPSERTED', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const encrypted = encryptAuditPayload(
      service,
      SpaceAuditEventType.ADDRESS_BOOK_UPSERTED,
      {
        created: [{ address, name: 'Alice' }],
        updated: [{ address, name: 'Bob' }],
        onBehalfOfUserId: 7,
      },
    );

    expect(encrypted).toStrictEqual({
      created: [{ address, name: 'E:Alice' }],
      updated: [{ address, name: 'E:Bob' }],
      onBehalfOfUserId: 7,
    });
  });

  it('encrypts ADDRESS_BOOK_DELETED name but not the address', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const encrypted = encryptAuditPayload(
      service,
      SpaceAuditEventType.ADDRESS_BOOK_DELETED,
      { address, name: 'Carol' },
    );

    expect(encrypted).toStrictEqual({ address, name: 'E:Carol' });
  });

  it('leaves payloads without name fields unchanged', () => {
    const payload: SpaceAuditEventPayload = {
      targetUserId: 1,
      role: 'ADMIN',
    };

    const encrypted = encryptAuditPayload(
      service,
      SpaceAuditEventType.MEMBER_INVITED,
      payload,
    );

    expect(encrypted).toStrictEqual(payload);
  });
});
