// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';

/**
 * Space-scoped field-encryption policy for the spaces module: space names,
 * space Safes, address-book items/requests, and audit-log payloads.
 *
 * A thin wrapper over {@link KmsEncryptionService} that builds the
 * `{ spaceId }` encryption context so repositories never handle it directly.
 * All crypto mechanics and gating (enabled/disabled, plaintext passthrough
 * while disabled) live in {@link KmsEncryptionService}.
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
        address: await this.kmsEncryption.decrypt(
          safe.address,
          this.context(spaceId),
        ),
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
   * Encrypts an entire audit payload as one blob: the payload is serialized to
   * JSON and encrypted under the row's space scope. Returns the plaintext JSON
   * unchanged when encryption is disabled ({@link KmsEncryptionService}).
   */
  async encryptAuditPayload(
    spaceId: number,
    payload: unknown,
  ): Promise<string> {
    return await this.kmsEncryption.encrypt(
      JSON.stringify(payload),
      this.context(spaceId),
    );
  }

  /**
   * Reverse of {@link encryptAuditPayload}: decrypts the blob under the row's
   * space scope and parses it back to the payload object. Plaintext JSON
   * (written while encryption was disabled) passes through unchanged inside
   * {@link KmsEncryptionService.decrypt}.
   */
  async decryptAuditPayload(
    spaceId: number,
    payload: string,
  ): Promise<unknown> {
    const json = await this.kmsEncryption.decrypt(
      payload,
      this.context(spaceId),
    );
    return JSON.parse(json);
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
}
