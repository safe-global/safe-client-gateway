// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';

/**
 * Space-scoped field-encryption policy for the spaces module: space names,
 * space Safes, address-book items/requests, and audit-log payloads.
 *
 * A thin wrapper over {@link KmsEncryptionService} that builds the
 * `{ spaceId }` encryption context so repositories never handle it directly.
 * All crypto mechanics and gating (enabled/disabled, plaintext passthrough
 * during the backfill window) live in {@link KmsEncryptionService}.
 */
@Injectable()
export class SpaceEncryptionService {
  constructor(
    @Inject(KmsEncryptionService)
    private readonly kmsEncryption: KmsEncryptionService,
  ) {}

  private context(spaceId: number): Record<string, string> {
    return { spaceId: String(spaceId) };
  }

  isEncrypted(value: string): boolean {
    return this.kmsEncryption.isEncrypted(value);
  }

  async encryptSpaceName(spaceId: number, name: string): Promise<string> {
    return await this.kmsEncryption.encrypt(name, this.context(spaceId));
  }

  async decryptSpaceName(spaceId: number, value: string): Promise<string> {
    return await this.kmsEncryption.decrypt(value, this.context(spaceId));
  }

  /**
   * Returns copies of the given spaces with `name` decrypted, each under its
   * own space-scoped context. The input is left untouched. Callers must load
   * both `id` and `name`.
   */
  async decryptSpaces<T extends { id: number; name: string }>(
    spaces: Array<T>,
  ): Promise<Array<T>> {
    return await Promise.all(
      spaces.map(async (space) => ({
        ...space,
        name: (await this.decryptSpaceName(space.id, space.name)) as T['name'],
      })),
    );
  }

  async encryptSafeAddress(spaceId: number, address: string): Promise<string> {
    return await this.kmsEncryption.encrypt(address, this.context(spaceId));
  }

  safeAddressIndex(address: string): string | null {
    return this.kmsEncryption.blindIndex(address);
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
        address: (await this.kmsEncryption.decrypt(
          safe.address,
          this.context(spaceId),
        )) as T['address'],
      })),
    );
  }

  async encryptAddressBookItem(
    spaceId: number,
    entry: { address: string; name: string },
  ): Promise<{ address: string; name: string; addressIndex: string | null }> {
    const [address, name] = await Promise.all([
      this.kmsEncryption.encrypt(entry.address, this.context(spaceId)),
      this.kmsEncryption.encrypt(entry.name, this.context(spaceId)),
    ]);
    return {
      address,
      name,
      addressIndex: this.itemAddressIndex(entry.address),
    };
  }

  itemAddressIndex(address: string): string | null {
    return this.kmsEncryption.blindIndex(address);
  }

  async decryptAddressBookItems<T extends { address: string; name: string }>(
    spaceId: number,
    items: Array<T>,
  ): Promise<Array<T>> {
    return await this.decryptEntries(spaceId, items);
  }

  async encryptAddressBookRequest(
    spaceId: number,
    entry: { address: string; name: string },
  ): Promise<{ address: string; name: string; addressIndex: string | null }> {
    const [address, name] = await Promise.all([
      this.kmsEncryption.encrypt(entry.address, this.context(spaceId)),
      this.kmsEncryption.encrypt(entry.name, this.context(spaceId)),
    ]);
    return {
      address,
      name,
      addressIndex: this.requestAddressIndex(entry.address),
    };
  }

  requestAddressIndex(address: string): string | null {
    return this.kmsEncryption.blindIndex(address);
  }

  async decryptAddressBookRequests<T extends { address: string; name: string }>(
    spaceId: number,
    requests: Array<T>,
  ): Promise<Array<T>> {
    return await this.decryptEntries(spaceId, requests);
  }

  /**
   * Returns a copy of an audit payload with every encrypted member decrypted
   * under the row's space scope. Writers put the source row's ciphertext into
   * payloads, and encryption contexts are space-scoped with no row ids, so
   * `spaceId` alone reconstructs every context. Plaintext members (legacy
   * rows, or encryption disabled) pass through unchanged inside
   * {@link KmsEncryptionService.decrypt}.
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
          safes: await this.decryptPayloadEntries(spaceId, payload.safes),
        };
      case SpaceAuditEventType.ADDRESS_BOOK_UPSERTED:
        return {
          ...payload,
          created: await this.decryptPayloadEntries(spaceId, payload.created),
          updated: await this.decryptPayloadEntries(spaceId, payload.updated),
        };
      case SpaceAuditEventType.ADDRESS_BOOK_DELETED:
        return {
          ...payload,
          ...(typeof payload.address === 'string' && {
            address: await this.kmsEncryption.decrypt(
              payload.address,
              this.context(spaceId),
            ),
          }),
          ...(typeof payload.name === 'string' && {
            name: await this.kmsEncryption.decrypt(
              payload.name,
              this.context(spaceId),
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
  ): Promise<Array<T>> {
    return await Promise.all(
      entries.map(async (entry) => {
        const [address, name] = await Promise.all([
          this.kmsEncryption.decrypt(entry.address, this.context(spaceId)),
          this.kmsEncryption.decrypt(entry.name, this.context(spaceId)),
        ]);
        return {
          ...entry,
          address,
          name,
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

  private async decryptPayloadEntries(
    spaceId: number,
    entries: unknown,
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
            address: await this.kmsEncryption.decrypt(
              record.address,
              this.context(spaceId),
            ),
          }),
          ...(typeof record.name === 'string' && {
            name: await this.kmsEncryption.decrypt(
              record.name,
              this.context(spaceId),
            ),
          }),
        };
      }),
    );
  }
}
