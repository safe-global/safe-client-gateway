// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { Address } from 'viem';
import type {
  AddressBookTag,
  TagColorChoices,
  TagNames,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';

export const IAddressBookTagsRepository = Symbol('IAddressBookTagsRepository');

/**
 * Data access only: the caller (a route service) asserts the workspace
 * membership before reaching this repository. Every write takes the per-space
 * tag-write lock first, so tag writes of one space are serialised.
 */
export interface IAddressBookTagsRepository {
  /** All tags of the space (names decrypted) and which item has which tag. */
  findBySpaceId(spaceId: number): Promise<{
    tags: Array<AddressBookTag>;
    itemTagIds: Map<number, Array<number>>; // itemId -> tagIds
  }>;

  /**
   * Takes the per-space tag-write lock (`FOR NO KEY UPDATE` on the spaces row)
   * in the caller's transaction and returns the space's id and uuid. The admin
   * upsert path calls this first, before inserting contacts. Re-taking it later
   * in the same transaction is a no-op.
   */
  lockSpaceForTagWrites(
    entityManager: EntityManager,
    spaceId: number,
  ): Promise<{ id: number; uuid: UUID }>;

  /**
   * Replaces the tags of the given contacts, atomically: if any entry fails
   * (unknown address, 9th tag in the space) nothing is written. Creates missing
   * tags. Records one ADDRESS_BOOK_TAGS_UPDATED per contact whose tags actually
   * changed. Throws NotFoundException if an address is not in the book.
   * A created tag takes its colour from `tagColors` when no tag of the space
   * has that colour yet, else a random free one.
   */
  setTagsForItems(args: {
    userId: number;
    spaceId: number;
    entries: Array<{ address: Address; tags: TagNames }>;
    tagColors?: TagColorChoices;
    entityManager?: EntityManager;
  }): Promise<void>;

  /**
   * Renames a tag of the space, keeping its colour. Renaming to the name of
   * another tag of the space merges the two: the renamed tag's contacts move
   * to the existing tag and the renamed tag is deleted. Throws
   * NotFoundException if the tag is not in the space.
   */
  renameTag(args: {
    userId: number;
    spaceId: number;
    tagId: number;
    name: string;
  }): Promise<void>;

  /**
   * Deletes a tag of the space and removes it from every contact. Throws
   * NotFoundException if the tag is not in the space.
   */
  deleteTag(args: {
    userId: number;
    spaceId: number;
    tagId: number;
  }): Promise<void>;
}
