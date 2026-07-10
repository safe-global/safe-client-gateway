// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { EncryptedField } from '@/datasources/kms/field-crypto.constants';
import { FieldCryptoService } from '@/datasources/kms/field-crypto.service';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';

/**
 * Space-scoped field-encryption policy for the spaces module: space names,
 * space Safes, address-book items/requests, and audit-log payloads.
 *
 * A thin wrapper over {@link FieldCryptoService} that pins the field ids and
 * the `{ spaceId }` encryption-context scope so repositories never handle
 * either directly. All crypto mechanics and gating (enabled/disabled,
 * plaintext passthrough during the backfill window, decrypt caching) live in
 * {@link FieldCryptoService}.
 */
@Injectable()
export class SpaceFieldEncryptionService {
  constructor(
    @Inject(FieldCryptoService)
    private readonly fieldCryptoService: FieldCryptoService,
  ) {}

  isEncrypted(value: string): boolean {
    return this.fieldCryptoService.isEncrypted(value);
  }

  async encryptSpaceName(spaceId: number, name: string): Promise<string> {
    return await this.fieldCryptoService.encrypt(
      'spaces.name',
      { spaceId },
      name,
    );
  }

  async decryptSpaceName(spaceId: number, value: string): Promise<string> {
    return await this.fieldCryptoService.decrypt(
      'spaces.name',
      { spaceId },
      value,
    );
  }

  /**
   * Returns copies of the given spaces with `name` decrypted, each under its
   * own space-scoped context. The input is left untouched. Callers must load
   * both `id` and `name`.
   */
  async decryptSpaces<T extends { id: number; name: string }>(
    spaces: Array<T>,
  ): Promise<Array<T>> {
    // Independent KMS round-trips: run them concurrently rather than paying
    // an O(N) sequential latency tax on list reads (like decryptUserEmails).
    return await Promise.all(
      spaces.map(async (space) => ({
        ...space,
        name: (await this.decryptSpaceName(space.id, space.name)) as T['name'],
      })),
    );
  }

  async encryptSafeAddress(spaceId: number, address: string): Promise<string> {
    return await this.fieldCryptoService.encrypt(
      'space_safes.address',
      { spaceId },
      address,
    );
  }

  safeAddressIndex(address: string): string | null {
    return this.fieldCryptoService.blindIndex('space_safes.address', address);
  }

  /**
   * Returns copies of the given space Safes with `address` decrypted under
   * the owning space's context. The input is left untouched.
   */
  async decryptSpaceSafes<T extends { address: string }>(
    spaceId: number,
    safes: Array<T>,
  ): Promise<Array<T>> {
    return await Promise.all(
      safes.map(async (safe) => ({
        ...safe,
        address: (await this.fieldCryptoService.decrypt(
          'space_safes.address',
          { spaceId },
          safe.address,
        )) as T['address'],
      })),
    );
  }

  async encryptAddressBookItem(
    spaceId: number,
    entry: { address: string; name: string },
  ): Promise<{ address: string; name: string; addressIndex: string | null }> {
    const [address, name] = await Promise.all([
      this.fieldCryptoService.encrypt(
        'space_address_book_items.address',
        { spaceId },
        entry.address,
      ),
      this.fieldCryptoService.encrypt(
        'space_address_book_items.name',
        { spaceId },
        entry.name,
      ),
    ]);
    return {
      address,
      name,
      addressIndex: this.itemAddressIndex(entry.address),
    };
  }

  itemAddressIndex(address: string): string | null {
    return this.fieldCryptoService.blindIndex(
      'space_address_book_items.address',
      address,
    );
  }

  async decryptAddressBookItems<T extends { address: string; name: string }>(
    spaceId: number,
    items: Array<T>,
  ): Promise<Array<T>> {
    return await this.decryptEntries(
      spaceId,
      items,
      'space_address_book_items.address',
      'space_address_book_items.name',
    );
  }

  async encryptAddressBookRequest(
    spaceId: number,
    entry: { address: string; name: string },
  ): Promise<{ address: string; name: string; addressIndex: string | null }> {
    const [address, name] = await Promise.all([
      this.fieldCryptoService.encrypt(
        'address_book_requests.address',
        { spaceId },
        entry.address,
      ),
      this.fieldCryptoService.encrypt(
        'address_book_requests.name',
        { spaceId },
        entry.name,
      ),
    ]);
    return {
      address,
      name,
      addressIndex: this.requestAddressIndex(entry.address),
    };
  }

  requestAddressIndex(address: string): string | null {
    return this.fieldCryptoService.blindIndex(
      'address_book_requests.address',
      address,
    );
  }

  async decryptAddressBookRequests<T extends { address: string; name: string }>(
    spaceId: number,
    requests: Array<T>,
  ): Promise<Array<T>> {
    return await this.decryptEntries(
      spaceId,
      requests,
      'address_book_requests.address',
      'address_book_requests.name',
    );
  }

  /**
   * Returns a copy of an audit payload with every encrypted member decrypted
   * under its source field id. Writers put the source row's ciphertext into
   * payloads, and encryption contexts are space-scoped with no row ids, so
   * `spaceId` plus the event type are enough to reconstruct every context.
   * Plaintext members (legacy rows, or encryption disabled) pass through
   * unchanged inside {@link FieldCryptoService.decrypt}.
   */
  async decryptAuditPayload(
    spaceId: number,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (eventType) {
      case SpaceAuditEventType.SPACE_CREATED:
      case SpaceAuditEventType.SPACE_DELETED:
        return {
          ...payload,
          ...(typeof payload.name === 'string' && {
            name: await this.decryptSpaceName(spaceId, payload.name),
          }),
        };
      case SpaceAuditEventType.SPACE_UPDATED:
        return {
          ...payload,
          old: await this.decryptSpaceFieldsMember(spaceId, payload.old),
          new: await this.decryptSpaceFieldsMember(spaceId, payload.new),
        };
      case SpaceAuditEventType.SAFE_ADDED:
      case SpaceAuditEventType.SAFE_REMOVED:
        return {
          ...payload,
          safes: await this.decryptPayloadEntries(
            spaceId,
            payload.safes,
            'space_safes.address',
          ),
        };
      case SpaceAuditEventType.ADDRESS_BOOK_UPSERTED:
        return {
          ...payload,
          created: await this.decryptPayloadEntries(
            spaceId,
            payload.created,
            'space_address_book_items.address',
            'space_address_book_items.name',
          ),
          updated: await this.decryptPayloadEntries(
            spaceId,
            payload.updated,
            'space_address_book_items.address',
            'space_address_book_items.name',
          ),
        };
      case SpaceAuditEventType.ADDRESS_BOOK_DELETED:
        return {
          ...payload,
          ...(typeof payload.address === 'string' && {
            address: await this.fieldCryptoService.decrypt(
              'space_address_book_items.address',
              { spaceId },
              payload.address,
            ),
          }),
          ...(typeof payload.name === 'string' && {
            name: await this.fieldCryptoService.decrypt(
              'space_address_book_items.name',
              { spaceId },
              payload.name,
            ),
          }),
        };
      default:
        // Member events carry user ids, never encrypted values.
        return payload;
    }
  }

  /** Decrypts the address+name members of a list of entries, per entry. */
  private async decryptEntries<T extends { address: string; name: string }>(
    spaceId: number,
    entries: Array<T>,
    addressField: EncryptedField,
    nameField: EncryptedField,
  ): Promise<Array<T>> {
    return await Promise.all(
      entries.map(async (entry) => {
        const [address, name] = await Promise.all([
          this.fieldCryptoService.decrypt(
            addressField,
            { spaceId },
            entry.address,
          ),
          this.fieldCryptoService.decrypt(nameField, { spaceId }, entry.name),
        ]);
        return {
          ...entry,
          address: address as T['address'],
          name: name as T['name'],
        };
      }),
    );
  }

  /** Decrypts the optional `name` member of a SPACE_UPDATED old/new object. */
  private async decryptSpaceFieldsMember(
    spaceId: number,
    fields: unknown,
  ): Promise<unknown> {
    if (fields === null || typeof fields !== 'object') {
      return fields;
    }
    const record = fields as Record<string, unknown>;
    return {
      ...record,
      ...(typeof record.name === 'string' && {
        name: await this.decryptSpaceName(spaceId, record.name),
      }),
    };
  }

  /** Decrypts `address` (and optionally `name`) members of payload arrays. */
  private async decryptPayloadEntries(
    spaceId: number,
    entries: unknown,
    addressField: EncryptedField,
    nameField?: EncryptedField,
  ): Promise<unknown> {
    if (!Array.isArray(entries)) {
      return entries;
    }
    return await Promise.all(
      entries.map(async (entry: unknown) => {
        if (entry === null || typeof entry !== 'object') {
          return entry;
        }
        const record = entry as Record<string, unknown>;
        return {
          ...record,
          ...(typeof record.address === 'string' && {
            address: await this.fieldCryptoService.decrypt(
              addressField,
              { spaceId },
              record.address,
            ),
          }),
          ...(nameField !== undefined &&
            typeof record.name === 'string' && {
              name: await this.fieldCryptoService.decrypt(
                nameField,
                { spaceId },
                record.name,
              ),
            }),
        };
      }),
    );
  }
}
