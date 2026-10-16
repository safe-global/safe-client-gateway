// SPDX-License-Identifier: FSL-1.1-MIT

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EntityManager,
  type FindOptionsWhere,
  In,
  IsNull,
  type Repository,
} from 'typeorm';
import { type Address, isAddressEqual } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { AddressBookItem as DbAddressBookItem } from '#/modules/spaces/datasources/address-books/entities/address-book-item.entity.db';
import { Space as DbSpace } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import { IAddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { AddressBookDbItem } from '#/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import { AddressBookItem } from '#/modules/spaces/domain/address-books/entities/address-book-item.entity';
import { SpaceAuditEventType } from '#/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '#/modules/spaces/domain/audit/space-audit.repository.interface';
import { Space } from '#/modules/spaces/domain/entities/space.entity';
import { SpaceEncryptionService } from '#/modules/spaces/domain/space-encryption.service';
import { ISpacesRepository } from '#/modules/spaces/domain/spaces.repository.interface';
import { UpsertAddressBookItemsDto } from '#/modules/spaces/routes/address-books/entities/upsert-address-book-items.dto.entity';
import type { User } from '#/modules/users/domain/entities/user.entity';

@Injectable()
export class AddressBookItemsRepository implements IAddressBookItemsRepository {
  private readonly maxItems: number;

  constructor(
    private readonly db: PostgresDatabaseService,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
    @Inject(SpaceEncryptionService)
    private readonly spaceEncryptionService: SpaceEncryptionService,
  ) {
    this.maxItems = this.configurationService.getOrThrow<number>(
      'spaces.addressBooks.maxItems',
    );
  }

  public async findAllBySpaceId(
    spaceId: Space['id'],
  ): Promise<Array<AddressBookDbItem>> {
    const repository = await this.db.getRepository(DbAddressBookItem);
    const items = await repository.findBy({ space: { id: spaceId } });
    return await this.spaceEncryptionService.decryptAddressBookItems(
      spaceId,
      items,
    );
  }

  public async upsertMany(args: {
    userId: User['id'];
    spaceId: Space['id'];
    addressBookItems: UpsertAddressBookItemsDto['items'];
    createdByOverride?: number;
    entityManager?: EntityManager;
  }): Promise<Array<AddressBookDbItem>> {
    const { userId } = args;
    const space = await this.findSpaceOrFail(args.spaceId, args.entityManager);

    const run = async (
      entityManager: EntityManager,
    ): Promise<Array<AddressBookDbItem>> => {
      const updated = await this.updateExistingAddressBookItems({
        entityManager,
        addressBookItems: args.addressBookItems,
        space,
        userId,
      });

      const newAddressBookItems = args.addressBookItems.filter(
        (item) =>
          !updated.some((existingItem) =>
            isAddressEqual(existingItem.address, item.address),
          ),
      );

      const created = await this.createNewAddressBookItems({
        entityManager,
        addressBookItems: newAddressBookItems,
        space,
        userId,
        createdByOverride: args.createdByOverride,
      });

      if (updated.length > 0 || newAddressBookItems.length > 0) {
        await this.spaceAuditRepository.record(entityManager, {
          spaceId: space.id,
          spaceUuid: space.uuid,
          eventType: SpaceAuditEventType.ADDRESS_BOOK_UPSERTED,
          actorUserId: userId,
          payload: {
            created,
            updated: updated.map((item) => item.audit),
            ...(args.createdByOverride !== undefined && {
              onBehalfOfUserId: args.createdByOverride,
            }),
          },
        });
      }

      const rows = await entityManager.findBy(DbAddressBookItem, {
        space: { id: space.id },
      });

      return await this.spaceEncryptionService.decryptAddressBookItems(
        space.id,
        rows,
      );
    };

    return args.entityManager
      ? await run(args.entityManager)
      : await this.db.transaction(run);
  }

  public async findItemIdsByAddresses(args: {
    spaceId: Space['id'];
    addresses: Array<Address>;
    entityManager?: EntityManager;
  }): Promise<Map<string, number>> {
    const itemIds = new Map<string, number>();
    if (args.addresses.length === 0) {
      return itemIds;
    }
    const repository = args.entityManager
      ? args.entityManager.getRepository(DbAddressBookItem)
      : await this.db.getRepository(DbAddressBookItem);
    const matches = await this.findMatchingItems({
      repository,
      spaceId: args.spaceId,
      inputs: args.addresses.map((address) => ({ address })),
    });
    for (const { row, input } of matches) {
      itemIds.set(input.address.toLowerCase(), row.id);
    }
    return itemIds;
  }

  public async deleteByAddress(args: {
    userId: User['id'];
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void> {
    const { userId } = args;
    const space = await this.findSpaceOrFail(args.spaceId);

    await this.db.transaction(async (entityManager) => {
      const addressIndex = this.spaceEncryptionService.itemAddressIndex(
        args.address,
      );
      // Encryption disabled: match plaintext with a NULL index. Otherwise
      // match on the blind index.
      const where: FindOptionsWhere<DbAddressBookItem> =
        addressIndex === null
          ? {
              address: args.address,
              space: { id: space.id },
              addressIndex: IsNull(),
            }
          : { space: { id: space.id }, addressIndex };
      const item = await entityManager.findOne(DbAddressBookItem, { where });
      if (!item) {
        return;
      }

      await entityManager.delete(DbAddressBookItem, item.id);

      // Row carries ciphertext; decrypt to plaintext for the payload (the audit
      // repository encrypts the whole payload as one blob).
      const [decrypted] =
        await this.spaceEncryptionService.decryptAddressBookItems(space.id, [
          item,
        ]);
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.ADDRESS_BOOK_DELETED,
        actorUserId: userId,
        payload: { address: decrypted.address, name: decrypted.name },
      });
    });
  }

  /**
   * The owning space, as the insert relation and the audit identifiers.
   *
   * Given the caller's transaction, reads through it: a second pool connection
   * taken while that transaction holds the space's tag lock can wait for good
   * on a pool whose other connections all wait on that lock.
   */
  private async findSpaceOrFail(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<Pick<Space, 'id' | 'uuid'>> {
    if (!entityManager) {
      return await this.spacesRepository.findOneOrFail({
        where: { id: spaceId },
        select: { id: true, uuid: true },
      });
    }
    const space = await entityManager.findOne(DbSpace, {
      where: { id: spaceId },
      select: { id: true, uuid: true },
    });
    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }
    return space;
  }

  /**
   * Loads the Space's rows whose address is one of the inputs', each paired
   * with the first input it matches.
   *
   * Enabled: match encrypted rows on their blind index. Disabled: no index
   * key, so match the stored plaintext (address_index IS NULL) directly.
   */
  private async findMatchingItems<T extends { address: Address }>(args: {
    repository: Repository<DbAddressBookItem>;
    spaceId: Space['id'];
    inputs: Array<T>;
  }): Promise<Array<{ row: DbAddressBookItem; input: T }>> {
    // Compute each input's blind index once (one HMAC per input) and key a
    // lookup by it, so the per-row match below is O(1) rather than recomputing
    // the HMAC for every candidate on every existing row.
    const inputByIndex = new Map<string, T>();
    for (const input of args.inputs) {
      const index = this.spaceEncryptionService.itemAddressIndex(input.address);
      // Keep the first input for a given index, matching the prior `.find`.
      if (index !== null && !inputByIndex.has(index)) {
        inputByIndex.set(index, input);
      }
    }
    const indexes = Array.from(inputByIndex.keys());
    const where: FindOptionsWhere<DbAddressBookItem> =
      indexes.length > 0
        ? { space: { id: args.spaceId }, addressIndex: In(indexes) }
        : {
            space: { id: args.spaceId },
            addressIndex: IsNull(),
            address: In(args.inputs.map((input) => input.address)),
          };
    const rows = await args.repository.findBy(where);

    const matches: Array<{ row: DbAddressBookItem; input: T }> = [];
    for (const row of rows) {
      // Encrypted rows match on the blind index; plaintext rows on the address.
      const input =
        row.addressIndex != null
          ? inputByIndex.get(row.addressIndex)
          : args.inputs.find((candidate) =>
              isAddressEqual(candidate.address, row.address),
            );
      if (input) {
        matches.push({ row, input });
      }
    }
    return matches;
  }

  /**
   * @returns each updated row as `{ address }` (plaintext, for the new-items
   * filter) plus `{ audit }` (the plaintext `{ address, name }` for the audit
   * payload, which is encrypted as a whole blob by the audit repository).
   */
  private async updateExistingAddressBookItems(args: {
    userId: number;
    addressBookItems: Array<AddressBookItem>;
    space: Pick<Space, 'id'>;
    entityManager: EntityManager;
  }): Promise<
    Array<{
      address: AddressBookItem['address'];
      audit: { address: AddressBookItem['address']; name: string };
    }>
  > {
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    const matches = await this.findMatchingItems({
      repository,
      spaceId: args.space.id,
      inputs: args.addressBookItems,
    });

    const updated: Array<{
      address: AddressBookItem['address'];
      audit: { address: AddressBookItem['address']; name: string };
    }> = [];
    for (const { row: item, input: patch } of matches) {
      // Encrypt-on-write: rewrite the (unchanged) address and the new name
      // under the space-scoped context.
      const encrypted =
        await this.spaceEncryptionService.encryptAddressBookItem(
          args.space.id,
          { address: patch.address, name: patch.name },
        );
      await repository.update(item.id, {
        address: encrypted.address as AddressBookItem['address'],
        addressIndex: encrypted.addressIndex,
        name: encrypted.name,
        chainIds: patch.chainIds,
        lastUpdatedBy: args.userId,
      });
      updated.push({
        address: patch.address,
        audit: {
          address: patch.address,
          name: patch.name,
        },
      });
    }
    return updated;
  }

  /** @returns the plaintext `{ address, name }` of the new rows, for the audit
   * payload (encrypted as a whole blob by the audit repository). */
  private async createNewAddressBookItems(args: {
    userId: number;
    addressBookItems: Array<AddressBookItem>;
    space: Pick<Space, 'id'>;
    entityManager: EntityManager;
    createdByOverride?: number;
  }): Promise<Array<{ address: AddressBookItem['address']; name: string }>> {
    if (args.addressBookItems.length === 0) {
      return [];
    }
    await this.checkItemsLimit(args);
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    // The owning space id is known, so ciphertext + blind index are computed up
    // front — no two-phase dance.
    const encrypted = await Promise.all(
      args.addressBookItems.map((addressBookItem) =>
        this.spaceEncryptionService.encryptAddressBookItem(args.space.id, {
          address: addressBookItem.address,
          name: addressBookItem.name,
        }),
      ),
    );
    await repository.insert(
      args.addressBookItems.map((addressBookItem, index) => ({
        space: args.space,
        address: encrypted[index].address as AddressBookItem['address'],
        addressIndex: encrypted[index].addressIndex,
        name: encrypted[index].name,
        chainIds: addressBookItem.chainIds,
        createdBy: args.createdByOverride ?? args.userId,
        lastUpdatedBy: args.userId,
      })),
    );
    return args.addressBookItems.map((item) => ({
      address: item.address,
      name: item.name,
    }));
  }

  private async checkItemsLimit(args: {
    space: Pick<Space, 'id'>;
    addressBookItems: Array<AddressBookItem>;
    entityManager: EntityManager;
  }): Promise<void> {
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    const existingAddressBookItems = await repository.count({
      where: { space: { id: args.space.id } },
    });
    const totalAddressBookItemsCount =
      existingAddressBookItems + args.addressBookItems.length;
    if (totalAddressBookItemsCount > this.maxItems) {
      throw new BadRequestException(
        `This Workspace only allows a maximum of ${this.maxItems} Address Book Items. You can only add up to ${this.maxItems - existingAddressBookItems} more.`,
      );
    }
  }
}
