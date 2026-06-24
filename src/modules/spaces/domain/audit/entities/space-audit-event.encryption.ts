// SPDX-License-Identifier: FSL-1.1-MIT

import { FieldEncryptionAad } from '@/datasources/encryption/field-encryption.constants';
import type { IFieldEncryptionService } from '@/datasources/encryption/field-encryption.service.interface';
import {
  type SpaceAuditEventPayload,
  SpaceAuditEventType,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';

type NameMapper = (name: string) => string;

interface NamedPayload {
  name: string;
}
interface SpaceUpdatedLikePayload {
  old: { name?: string; status?: string };
  new: { name?: string; status?: string };
}
interface AddressBookEntry {
  address: string;
  name: string;
}
interface AddressBookUpsertedLikePayload {
  created: Array<AddressBookEntry>;
  updated: Array<AddressBookEntry>;
  onBehalfOfUserId?: number;
}

function mapEntryNames(
  entries: Array<AddressBookEntry>,
  mapName: NameMapper,
): Array<AddressBookEntry> {
  return entries.map((entry) => ({ ...entry, name: mapName(entry.name) }));
}

function mapFieldName<T extends { name?: string }>(
  fields: T,
  mapName: NameMapper,
): T {
  return fields.name === undefined
    ? fields
    : { ...fields, name: mapName(fields.name) };
}

/**
 * Returns a copy of an audit payload with every human-entered name field passed
 * through `mapName`. Event types that carry no name fields are returned as-is.
 *
 * The shape is trusted to match `eventType` (the caller validates with the
 * discriminated-union schema before recording).
 */
export function mapAuditPayloadNames(
  eventType: SpaceAuditEventType,
  payload: SpaceAuditEventPayload,
  mapName: NameMapper,
): SpaceAuditEventPayload {
  switch (eventType) {
    case SpaceAuditEventType.SPACE_CREATED:
    case SpaceAuditEventType.SPACE_DELETED:
    case SpaceAuditEventType.ADDRESS_BOOK_DELETED: {
      const p = payload as NamedPayload;
      return { ...p, name: mapName(p.name) } as SpaceAuditEventPayload;
    }
    case SpaceAuditEventType.SPACE_UPDATED: {
      const p = payload as SpaceUpdatedLikePayload;
      return {
        old: mapFieldName(p.old, mapName),
        new: mapFieldName(p.new, mapName),
      } as SpaceAuditEventPayload;
    }
    case SpaceAuditEventType.ADDRESS_BOOK_UPSERTED: {
      const p = payload as AddressBookUpsertedLikePayload;
      return {
        ...p,
        created: mapEntryNames(p.created, mapName),
        updated: mapEntryNames(p.updated, mapName),
      } as SpaceAuditEventPayload;
    }
    default:
      return payload;
  }
}

export function encryptAuditPayload(
  service: IFieldEncryptionService,
  eventType: SpaceAuditEventType,
  payload: SpaceAuditEventPayload,
): SpaceAuditEventPayload {
  return mapAuditPayloadNames(eventType, payload, (name) =>
    service.encrypt(name, FieldEncryptionAad.SPACE_AUDIT_NAME),
  );
}

export function decryptAuditPayload(
  service: IFieldEncryptionService,
  eventType: SpaceAuditEventType,
  payload: SpaceAuditEventPayload,
): SpaceAuditEventPayload {
  return mapAuditPayloadNames(eventType, payload, (name) =>
    service.decrypt(name, FieldEncryptionAad.SPACE_AUDIT_NAME),
  );
}

/**
 * Collects every human-entered name in an audit payload, in the deterministic
 * traversal order of {@link mapAuditPayloadNames}. Pairs with
 * {@link applyAuditPayloadNames} so names can be encrypted/decrypted in a single
 * batch (per-space envelope encryption is async and key-bound, so it cannot run
 * inside the synchronous `mapName` callback).
 */
export function collectAuditPayloadNames(
  eventType: SpaceAuditEventType,
  payload: SpaceAuditEventPayload,
): Array<string> {
  const names: Array<string> = [];
  mapAuditPayloadNames(eventType, payload, (name) => {
    names.push(name);
    return name;
  });
  return names;
}

/**
 * Rebuilds an audit payload, substituting names in the same traversal order
 * they were collected by {@link collectAuditPayloadNames}.
 */
export function applyAuditPayloadNames(
  eventType: SpaceAuditEventType,
  payload: SpaceAuditEventPayload,
  names: ReadonlyArray<string>,
): SpaceAuditEventPayload {
  let index = 0;
  return mapAuditPayloadNames(eventType, payload, () => names[index++]);
}
