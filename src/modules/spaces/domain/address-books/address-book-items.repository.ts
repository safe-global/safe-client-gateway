// SPDX-License-Identifier: FSL-1.1-MIT

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EntityManager, type FindOptionsWhere, In, IsNull } from 'typeorm';
import { isAddressEqual } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { AddressBookItem as DbAddressBookItem } from '@/modules/spaces/datasources/address-books/entities/address-book-item.entity.db';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceEncryptionService } from '@/modules/spaces/domain/space-encryption.service';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { UpsertAddressBookItemsDto } from '@/modules/spaces/routes/address-books/entities/upsert-address-book-items.dto.entity';
import { MemberRole } from '@/modules/users/domain/entities/member.entity';

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

  public async findAllBySpaceId(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Array<AddressBookDbItem>> {
    const space = await this.getSpaceAs({
      ...args,
      memberRoleIn: ['ADMIN', 'MEMBER'],
    });
    const repository = await this.db.getRepository(DbAddressBookItem);
    const items = await repository.findBy({ space: { id: space.id } });
    return await this.spaceEncryptionService.decryptAddressBookItems(
      space.id,
      items,
    );
  }

  public async upsertMany(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    addressBookItems: UpsertAddressBookItemsDto['items'];
    createdByOverride?: number;
    entityManager?: EntityManager;
  }): Promise<Array<AddressBookDbItem>> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    const space = await this.getSpaceAs({
      ...args,
      memberRoleIn: ['ADMIN'],
    });

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

  public async deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    const space = await this.getSpaceAs({
      ...args,
      memberRoleIn: ['ADMIN'],
    });

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

      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.ADDRESS_BOOK_DELETED,
        actorUserId: userId,
        // Pattern 5: the row's stored (ciphertext) values.
        payload: { address: item.address, name: item.name },
      });
    });
  }

  private async getSpaceAs(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    memberRoleIn: Array<keyof typeof MemberRole>;
  }): Promise<Space> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    return await this.spacesRepository.findOneOrFail({
      where: {
        id: args.spaceId,
        members: {
          role: In(args.memberRoleIn),
          user: { id: userId },
          status: 'ACTIVE',
        },
      },
    });
  }

  /**
   * @returns each updated row as `{ address }` (plaintext, for the new-items
   * filter) plus `{ audit }` (the ciphertext written to the row, for the audit
   * payload — contract pattern 5).
   */
  private async updateExistingAddressBookItems(args: {
    userId: number;
    addressBookItems: Array<AddressBookItem>;
    space: Space;
    entityManager: EntityManager;
  }): Promise<
    Array<{
      address: AddressBookItem['address'];
      audit: { address: AddressBookItem['address']; name: string };
    }>
  > {
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    // Dual-read during the backfill window: encrypted rows match on the blind
    // index, not-yet-backfilled rows hold plaintext with a NULL index.
    // @todo Remove the plaintext arm once the backfill --verify passes.
    const indexes = args.addressBookItems
      .map((item) => this.spaceEncryptionService.itemAddressIndex(item.address))
      .filter((index): index is string => index !== null);
    const plaintextAddresses = args.addressBookItems.map(
      (item) => item.address,
    );
    const where: Array<FindOptionsWhere<DbAddressBookItem>> = [
      ...(indexes.length > 0
        ? [{ space: { id: args.space.id }, addressIndex: In(indexes) }]
        : []),
      {
        space: { id: args.space.id },
        addressIndex: IsNull(),
        address: In(plaintextAddresses),
      },
    ];
    const existingAddressBookItems = await repository.findBy(where);

    const updated: Array<{
      address: AddressBookItem['address'];
      audit: { address: AddressBookItem['address']; name: string };
    }> = [];
    for (const item of existingAddressBookItems) {
      // Encrypted rows match on the blind index; plaintext rows on the address.
      const patch =
        item.addressIndex != null
          ? args.addressBookItems.find(
              (addressBookItem) =>
                this.spaceEncryptionService.itemAddressIndex(
                  addressBookItem.address,
                ) === item.addressIndex,
            )
          : args.addressBookItems.find((addressBookItem) =>
              isAddressEqual(addressBookItem.address, item.address),
            );
      if (!patch) {
        continue;
      }
      // Encrypt-on-write: rewrite the (unchanged) address and the new name,
      // opportunistically backfilling not-yet-encrypted rows.
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
          address: encrypted.address as AddressBookItem['address'],
          name: encrypted.name,
        },
      });
    }
    return updated;
  }

  /** @returns the ciphertext `{ address, name }` written to the new rows. */
  private async createNewAddressBookItems(args: {
    userId: number;
    addressBookItems: Array<AddressBookItem>;
    space: Space;
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
    // Pattern 5: audit carries the ciphertext written to the rows.
    return encrypted.map((entry) => ({
      address: entry.address as AddressBookItem['address'],
      name: entry.name,
    }));
  }

  private async checkItemsLimit(args: {
    space: Space;
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
