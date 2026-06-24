// SPDX-License-Identifier: FSL-1.1-MIT

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { isAddressEqual } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { FieldEncryptionAad } from '@/datasources/encryption/field-encryption.constants';
import { PerEntityFieldCrypto } from '@/datasources/encryption/per-entity-field-crypto';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { AddressBookItem as DbAddressBookItem } from '@/modules/spaces/datasources/address-books/entities/address-book-item.entity.db';
import { Space as DbSpace } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import { Space } from '@/modules/spaces/domain/entities/space.entity';
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
    private readonly fieldCrypto: PerEntityFieldCrypto,
  ) {
    this.maxItems = this.configurationService.getOrThrow<number>(
      'spaces.addressBooks.maxItems',
    );
  }

  /**
   * Encrypts item names under the owning space's data key, minting and
   * persisting the space key if absent. Returns values unchanged when disabled.
   */
  private async encryptItemNames(
    entityManager: EntityManager,
    spaceId: Space['id'],
    fields: Array<{ value: string; aad: string }>,
  ): Promise<Array<string>> {
    if (fields.length === 0) {
      return [];
    }
    const space = await entityManager.findOne(DbSpace, {
      where: { id: spaceId },
      select: { id: true, encryptedDataKey: true },
    });
    const existingKey = space?.encryptedDataKey ?? null;
    const { encryptedDataKey, values } = await this.fieldCrypto.encryptFields(
      { spaceId: String(spaceId) },
      existingKey,
      fields,
    );
    if (encryptedDataKey !== null && encryptedDataKey !== existingKey) {
      await entityManager.update(DbSpace, spaceId, { encryptedDataKey });
    }
    return values;
  }

  /**
   * Decrypts loaded items' `name` under the space key (one unwrap per call).
   * `manager` must be supplied when the space key may have just been minted in
   * an open transaction. Skipped when no name is ciphertext.
   */
  private async decryptItems(
    spaceId: Space['id'],
    items: Array<DbAddressBookItem>,
    manager?: EntityManager,
  ): Promise<void> {
    const targets = items.filter((item) =>
      this.fieldCrypto.isEncrypted(item.name),
    );
    if (targets.length === 0) {
      return;
    }
    const space = manager
      ? await manager.findOne(DbSpace, {
          where: { id: spaceId },
          select: { id: true, encryptedDataKey: true },
        })
      : await (await this.db.getRepository(DbSpace)).findOne({
          where: { id: spaceId },
          select: { id: true, encryptedDataKey: true },
        });
    const decrypted = await this.fieldCrypto.decryptFields(
      { spaceId: String(spaceId) },
      space?.encryptedDataKey ?? null,
      targets.map((item) => ({
        value: item.name,
        aad: FieldEncryptionAad.ADDRESS_BOOK_ITEM_NAME,
      })),
    );
    decrypted.forEach((value, index) => {
      targets[index].name = value;
    });
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
    await this.decryptItems(space.id, items);
    return items;
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

      await this.createNewAddressBookItems({
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
            created: newAddressBookItems.map((item) => ({
              address: item.address,
              name: item.name,
            })),
            updated,
            ...(args.createdByOverride !== undefined && {
              onBehalfOfUserId: args.createdByOverride,
            }),
          },
        });
      }

      const items = await entityManager.findBy(DbAddressBookItem, {
        space: { id: space.id },
      });
      await this.decryptItems(space.id, items, entityManager);
      return items;
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
      const item = await entityManager.findOne(DbAddressBookItem, {
        where: { address: args.address, space: { id: space.id } },
      });
      if (!item) {
        return;
      }

      await entityManager.delete(DbAddressBookItem, item.id);

      // Decrypt the stored name so the audit payload carries plaintext (the
      // audit repository re-encrypts it under the space key).
      await this.decryptItems(space.id, [item], entityManager);

      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.ADDRESS_BOOK_DELETED,
        actorUserId: userId,
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

  /** @returns the updated items as `{ address, name }` pairs (new name). */
  private async updateExistingAddressBookItems(args: {
    userId: number;
    addressBookItems: Array<AddressBookItem>;
    space: Space;
    entityManager: EntityManager;
  }): Promise<Array<Pick<DbAddressBookItem, 'address' | 'name'>>> {
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    const existingAddressBookItems = await repository.findBy({
      space: { id: args.space.id },
      address: In(args.addressBookItems.map((item) => item.address)),
    });
    const matches: Array<{
      item: DbAddressBookItem;
      patch: AddressBookItem;
    }> = [];
    for (const item of existingAddressBookItems) {
      const patch = args.addressBookItems.find((addressBookItem) =>
        isAddressEqual(addressBookItem.address, item.address),
      );
      if (patch) {
        matches.push({ item, patch });
      }
    }

    // Encrypt all new names under the space key in a single batch.
    const encryptedNames = await this.encryptItemNames(
      args.entityManager,
      args.space.id,
      matches.map((match) => ({
        value: match.patch.name,
        aad: FieldEncryptionAad.ADDRESS_BOOK_ITEM_NAME,
      })),
    );

    const updated: Array<Pick<DbAddressBookItem, 'address' | 'name'>> = [];
    for (const [index, { item, patch }] of matches.entries()) {
      await repository.update(item.id, {
        name: encryptedNames[index],
        chainIds: patch.chainIds,
        lastUpdatedBy: args.userId,
      });
      // Plaintext name in the returned diff; the audit repository encrypts it.
      updated.push({ address: item.address, name: patch.name });
    }
    return updated;
  }

  private async createNewAddressBookItems(args: {
    userId: number;
    addressBookItems: Array<AddressBookItem>;
    space: Space;
    entityManager: EntityManager;
    createdByOverride?: number;
  }): Promise<Array<DbAddressBookItem['id']>> {
    await this.checkItemsLimit(args);
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    const encryptedNames = await this.encryptItemNames(
      args.entityManager,
      args.space.id,
      args.addressBookItems.map((addressBookItem) => ({
        value: addressBookItem.name,
        aad: FieldEncryptionAad.ADDRESS_BOOK_ITEM_NAME,
      })),
    );
    const insertedIds = await repository.insert(
      args.addressBookItems.map((addressBookItem, index) => ({
        space: args.space,
        address: addressBookItem.address,
        name: encryptedNames[index],
        chainIds: addressBookItem.chainIds,
        createdBy: args.createdByOverride ?? args.userId,
        lastUpdatedBy: args.userId,
      })),
    );
    return insertedIds.identifiers.map((i) => i.id);
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
