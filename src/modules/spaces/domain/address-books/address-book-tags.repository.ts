// SPDX-License-Identifier: FSL-1.1-MIT
import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type EntityManager, In } from 'typeorm';
import type { Address } from 'viem';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { AddressBookItemTag as DbAddressBookItemTag } from '#/modules/spaces/datasources/address-books/entities/address-book-item-tag.entity.db';
import { AddressBookTag as DbAddressBookTag } from '#/modules/spaces/datasources/address-books/entities/address-book-tag.entity.db';
import { IAddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { IAddressBookTagsRepository } from '#/modules/spaces/domain/address-books/address-book-tags.repository.interface';
import {
  type AddressBookTag,
  TAG_COLORS,
  type TagNames,
  WORKSPACE_TAG_LIMIT_MESSAGE,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import {
  type ContactTagChange,
  InsertedIdSchema,
  type LockedSpace,
  LockedSpaceRowsSchema,
  type ResolvedContact,
  type SpaceTags,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag-write.entity';
import {
  groupTagIdsByItemId,
  isSameSet,
  nameOf,
} from '#/modules/spaces/domain/address-books/helpers/address-book-tags.helper';
import { SpaceAuditEventType } from '#/modules/spaces/domain/audit/entities/space-audit-event.entity';
import {
  ISpaceAuditRepository,
  type SpaceAuditRecordArgs,
} from '#/modules/spaces/domain/audit/space-audit.repository.interface';
import { SpaceEncryptionService } from '#/modules/spaces/domain/space-encryption.service';

@Injectable()
export class AddressBookTagsRepository implements IAddressBookTagsRepository {
  constructor(
    private readonly db: PostgresDatabaseService,
    @Inject(IAddressBookItemsRepository)
    private readonly itemsRepository: IAddressBookItemsRepository,
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
    @Inject(SpaceEncryptionService)
    private readonly spaceEncryptionService: SpaceEncryptionService,
  ) {}

  public async findBySpaceId(spaceId: number): Promise<{
    tags: Array<AddressBookTag>;
    itemTagIds: Map<number, Array<number>>;
  }> {
    const tagRepository = await this.db.getRepository(DbAddressBookTag);
    const rows = await tagRepository.find({
      select: { id: true, name: true, color: true },
      where: { space: { id: spaceId } },
      order: { id: 'ASC' },
    });
    if (rows.length === 0) {
      return { tags: [], itemTagIds: new Map() };
    }
    const itemTagRepository = await this.db.getRepository(DbAddressBookItemTag);
    const [decrypted, links] = await Promise.all([
      this.spaceEncryptionService.decryptTagNames(spaceId, rows),
      itemTagRepository.find({
        select: { itemId: true, tagId: true },
        where: { tagId: In(rows.map((row) => row.id)) },
        order: { id: 'ASC' },
      }),
    ]);
    const contactCounts = new Map<number, number>();
    for (const link of links) {
      contactCounts.set(link.tagId, (contactCounts.get(link.tagId) ?? 0) + 1);
    }
    return {
      tags: decrypted.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        contactCount: contactCounts.get(tag.id) ?? 0,
      })),
      itemTagIds: groupTagIdsByItemId(links),
    };
  }

  /**
   * Serialises every tag write of one space. FOR NO KEY UPDATE, not FOR UPDATE:
   * contact and tag inserts take FOR KEY SHARE on this row through their FK, and
   * upgrading from that to FOR UPDATE deadlocks two concurrent admin upserts.
   * FOR NO KEY UPDATE does not conflict with FOR KEY SHARE but does with itself.
   */
  public async lockSpaceForTagWrites(
    entityManager: EntityManager,
    spaceId: number,
  ): Promise<LockedSpace> {
    const [space] = LockedSpaceRowsSchema.parse(
      await entityManager.query(
        'SELECT "id", "uuid" FROM "spaces" WHERE "id" = $1 FOR NO KEY UPDATE',
        [spaceId],
      ),
    );
    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }
    return space;
  }

  public async setTagsForItems(args: {
    userId: number;
    spaceId: number;
    entries: Array<{ address: Address; tags: TagNames }>;
    entityManager?: EntityManager;
  }): Promise<void> {
    const run = async (entityManager: EntityManager): Promise<void> => {
      const space = await this.lockSpaceForTagWrites(
        entityManager,
        args.spaceId,
      );
      const contacts = await this.resolveContactsOrFail(
        entityManager,
        space.id,
        args.entries,
      );
      const spaceTags = await this.loadSpaceTags(entityManager, space.id);
      const tagIdByIndex = await this.resolveOrCreateTags(
        entityManager,
        space.id,
        args.userId,
        args.entries.flatMap((entry) => entry.tags),
        spaceTags,
      );
      const currentTagIds = await this.findTagIdsByItemIds(
        entityManager,
        contacts.map((contact) => contact.itemId),
      );
      const changes = this.findTagChanges({
        spaceId: space.id,
        contacts,
        tagIdByIndex,
        currentTagIds,
      });
      await this.replaceItemTags(entityManager, {
        space,
        userId: args.userId,
        changes,
        spaceTags,
      });
    };
    return args.entityManager
      ? await run(args.entityManager)
      : await this.db.transaction(run);
  }

  public async renameTag(args: {
    userId: number;
    spaceId: number;
    tagId: number;
    name: string;
  }): Promise<void> {
    await this.db.transaction(async (entityManager) => {
      const space = await this.lockSpaceForTagWrites(
        entityManager,
        args.spaceId,
      );
      const tag = await this.findTagOrFail(entityManager, space.id, args.tagId);
      const payload = await this.renameOrMerge(entityManager, {
        spaceId: space.id,
        tag,
        name: args.name,
      });
      if (!payload) {
        return;
      }
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        actorUserId: args.userId,
        eventType: SpaceAuditEventType.ADDRESS_BOOK_TAG_RENAMED,
        payload,
      });
    });
  }

  public async deleteTag(args: {
    userId: number;
    spaceId: number;
    tagId: number;
  }): Promise<void> {
    await this.db.transaction(async (entityManager) => {
      const space = await this.lockSpaceForTagWrites(
        entityManager,
        args.spaceId,
      );
      const tag = await this.findTagOrFail(entityManager, space.id, args.tagId);
      const contactCount = await entityManager.count(DbAddressBookItemTag, {
        where: { tagId: tag.id },
      });
      // The junction rows go with the tag (ON DELETE CASCADE).
      await entityManager.delete(DbAddressBookTag, tag.id);
      const [name] = await this.decryptNames(space.id, [tag]);
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        actorUserId: args.userId,
        eventType: SpaceAuditEventType.ADDRESS_BOOK_TAG_DELETED,
        payload: { name, contactCount },
      });
    });
  }

  /** Matches each requested entry to its contact; NotFoundException if one is not in the book. */
  private async resolveContactsOrFail(
    entityManager: EntityManager,
    spaceId: number,
    entries: Array<{ address: Address; tags: TagNames }>,
  ): Promise<Array<ResolvedContact>> {
    const itemIds = await this.itemsRepository.findItemIdsByAddresses({
      spaceId,
      addresses: entries.map((entry) => entry.address),
      entityManager,
    });
    return entries.map((entry) => {
      const itemId = itemIds.get(entry.address.toLowerCase());
      if (itemId === undefined) {
        throw new NotFoundException('Address book item not found.');
      }
      return { itemId, address: entry.address, tags: entry.tags };
    });
  }

  /** At most {@link TAG_COLORS}.length rows, decrypted in one call. */
  private async loadSpaceTags(
    entityManager: EntityManager,
    spaceId: number,
  ): Promise<SpaceTags> {
    const rows = await entityManager.find(DbAddressBookTag, {
      select: { id: true, name: true, nameIndex: true, color: true },
      where: { space: { id: spaceId } },
    });
    const tags = await this.spaceEncryptionService.decryptTagNames(
      spaceId,
      rows,
    );
    return {
      idByIndex: new Map(tags.map((tag) => [tag.nameIndex, tag.id])),
      nameById: new Map(tags.map((tag) => [tag.id, tag.name])),
      usedColors: new Set(tags.map((tag) => tag.color)),
    };
  }

  /**
   * @returns the tag id of every requested name, keyed by name index; a name
   * no tag of the space has yet becomes a new tag (first spelling wins).
   */
  private async resolveOrCreateTags(
    entityManager: EntityManager,
    spaceId: number,
    userId: number,
    names: Array<string>,
    spaceTags: SpaceTags,
  ): Promise<Map<string, number>> {
    const tagIdByIndex = new Map<string, number>();
    for (const name of names) {
      const nameIndex = this.spaceEncryptionService.tagNameIndex(spaceId, name);
      if (tagIdByIndex.has(nameIndex)) {
        continue;
      }
      const tagId =
        spaceTags.idByIndex.get(nameIndex) ??
        (await this.createTag(entityManager, {
          spaceId,
          userId,
          name,
          nameIndex,
          spaceTags,
        }));
      tagIdByIndex.set(nameIndex, tagId);
    }
    return tagIdByIndex;
  }

  /** Takes a random colour no tag of the space has; none left = 8 tags. */
  private async createTag(
    entityManager: EntityManager,
    args: {
      spaceId: number;
      userId: number;
      name: string;
      nameIndex: string;
      spaceTags: SpaceTags;
    },
  ): Promise<number> {
    const { spaceTags } = args;
    const free = TAG_COLORS.filter((color) => !spaceTags.usedColors.has(color));
    if (free.length === 0) {
      throw new BadRequestException(WORKSPACE_TAG_LIMIT_MESSAGE);
    }
    const color = free[randomInt(free.length)];
    const result = await entityManager.insert(DbAddressBookTag, {
      space: { id: args.spaceId },
      name: await this.spaceEncryptionService.encryptTagName(
        args.spaceId,
        args.name,
      ),
      nameIndex: args.nameIndex,
      color,
      createdBy: args.userId,
    });
    const { id } = InsertedIdSchema.parse(result.identifiers[0]);
    spaceTags.idByIndex.set(args.nameIndex, id);
    spaceTags.nameById.set(id, args.name);
    spaceTags.usedColors.add(color);
    return id;
  }

  private async findTagIdsByItemIds(
    entityManager: EntityManager,
    itemIds: Array<number>,
  ): Promise<Map<number, Array<number>>> {
    if (itemIds.length === 0) {
      return new Map();
    }
    const links = await entityManager.find(DbAddressBookItemTag, {
      select: { itemId: true, tagId: true },
      where: { itemId: In(itemIds) },
      order: { id: 'ASC' },
    });
    return groupTagIdsByItemId(links);
  }

  /**
   * The contacts whose tag set changes, once each. A repeated address keeps
   * the tags of its last entry, compared against the stored set; an unchanged
   * set is no change (no write, no audit event).
   */
  private findTagChanges(args: {
    spaceId: number;
    contacts: Array<ResolvedContact>;
    tagIdByIndex: Map<string, number>;
    currentTagIds: Map<number, Array<number>>;
  }): Array<ContactTagChange> {
    const lastContactById = new Map<number, ResolvedContact>();
    for (const contact of args.contacts) {
      lastContactById.set(contact.itemId, contact);
    }
    return Array.from(lastContactById.values()).flatMap((contact) => {
      const oldTagIds = args.currentTagIds.get(contact.itemId) ?? [];
      const newTagIds = this.toTagIds(
        args.tagIdByIndex,
        args.spaceId,
        contact.tags,
      );
      return isSameSet(oldTagIds, newTagIds)
        ? []
        : [
            {
              itemId: contact.itemId,
              address: contact.address,
              oldTagIds,
              newTagIds,
            },
          ];
    });
  }

  /**
   * One DELETE and one INSERT for all changed contacts, then one audit event
   * per contact, recorded concurrently.
   *
   * Every payload is built before the first record starts, and a failed
   * record is rethrown only once all of them have settled. Failing early
   * would roll the transaction back while other records still await KMS, and
   * an INSERT sent after the ROLLBACK runs outside it and autocommits.
   */
  private async replaceItemTags(
    entityManager: EntityManager,
    args: {
      space: LockedSpace;
      userId: number;
      changes: Array<ContactTagChange>;
      spaceTags: SpaceTags;
    },
  ): Promise<void> {
    if (args.changes.length === 0) {
      return;
    }
    await entityManager.delete(DbAddressBookItemTag, {
      itemId: In(args.changes.map((change) => change.itemId)),
    });
    const links = args.changes.flatMap(({ itemId, newTagIds }) =>
      newTagIds.map((tagId) => ({ itemId, tagId })),
    );
    if (links.length > 0) {
      await entityManager.insert(DbAddressBookItemTag, links);
    }
    const events: Array<SpaceAuditRecordArgs> = args.changes.map((change) => ({
      spaceId: args.space.id,
      spaceUuid: args.space.uuid,
      actorUserId: args.userId,
      eventType: SpaceAuditEventType.ADDRESS_BOOK_TAGS_UPDATED,
      payload: {
        address: change.address,
        oldTags: change.oldTagIds.map((id) => nameOf(args.spaceTags, id)),
        newTags: change.newTagIds.map((id) => nameOf(args.spaceTags, id)),
      },
    }));
    const results = await Promise.allSettled(
      events.map((event) =>
        this.spaceAuditRepository.record(entityManager, event),
      ),
    );
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failure) {
      throw failure.reason;
    }
  }

  /** Every name was resolved by {@link resolveOrCreateTags}; a miss is a bug. */
  private toTagIds(
    tagIdByIndex: Map<string, number>,
    spaceId: number,
    names: TagNames,
  ): Array<number> {
    const tagIds = names.map((name) => {
      const tagId = tagIdByIndex.get(
        this.spaceEncryptionService.tagNameIndex(spaceId, name),
      );
      if (tagId === undefined) {
        throw new Error('Tag name was not resolved before assignment');
      }
      return tagId;
    });
    return Array.from(new Set(tagIds));
  }

  private async findTagOrFail(
    entityManager: EntityManager,
    spaceId: number,
    tagId: number,
  ): Promise<{ id: number; name: string; nameIndex: string }> {
    // Scoped by space: a tag id of another space is not found.
    const tag = await entityManager.findOne(DbAddressBookTag, {
      select: { id: true, name: true, nameIndex: true },
      where: { id: tagId, space: { id: spaceId } },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found.');
    }
    return tag;
  }

  /**
   * Renames the tag, or merges it into the space's tag that already has the
   * new name (that tag keeps its spelling and colour).
   *
   * @returns the audit payload, or null when the name is unchanged.
   */
  private async renameOrMerge(
    entityManager: EntityManager,
    args: {
      spaceId: number;
      tag: { id: number; name: string; nameIndex: string };
      name: string;
    },
  ): Promise<{ oldName: string; newName: string; merged: boolean } | null> {
    const { spaceId, tag } = args;
    const nameIndex = this.spaceEncryptionService.tagNameIndex(
      spaceId,
      args.name,
    );
    // A case-only change keeps the index: update the spelling, no merge.
    const target =
      nameIndex === tag.nameIndex
        ? null
        : await entityManager.findOne(DbAddressBookTag, {
            select: { id: true, name: true },
            where: { space: { id: spaceId }, nameIndex },
          });
    if (target) {
      const [oldName, newName] = await this.decryptNames(spaceId, [
        tag,
        target,
      ]);
      await this.mergeTag(entityManager, {
        sourceId: tag.id,
        targetId: target.id,
      });
      return { oldName, newName, merged: true };
    }
    const [oldName] = await this.decryptNames(spaceId, [tag]);
    if (oldName === args.name) {
      return null;
    }
    await entityManager.update(DbAddressBookTag, tag.id, {
      name: await this.spaceEncryptionService.encryptTagName(
        spaceId,
        args.name,
      ),
      nameIndex,
    });
    return { oldName, newName: args.name, merged: false };
  }

  /**
   * Moves the source's contacts to the target, skipping contacts that already
   * have the target, then deletes the source (its junction rows cascade).
   */
  private async mergeTag(
    entityManager: EntityManager,
    args: { sourceId: number; targetId: number },
  ): Promise<void> {
    await entityManager.query(
      `INSERT INTO "space_address_book_item_tags" ("item_id", "tag_id")
       SELECT "source"."item_id", $2
       FROM "space_address_book_item_tags" "source"
       WHERE "source"."tag_id" = $1
         AND NOT EXISTS (
           SELECT 1 FROM "space_address_book_item_tags" "target"
           WHERE "target"."item_id" = "source"."item_id"
             AND "target"."tag_id" = $2
         )`,
      [args.sourceId, args.targetId],
    );
    await entityManager.delete(DbAddressBookTag, args.sourceId);
  }

  private async decryptNames(
    spaceId: number,
    tags: Array<{ name: string }>,
  ): Promise<Array<string>> {
    const decrypted = await this.spaceEncryptionService.decryptTagNames(
      spaceId,
      tags,
    );
    return decrypted.map((tag) => tag.name);
  }
}
