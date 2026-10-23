// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  ResolvedContact,
  SpaceTags,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag-write.entity';

export function groupTagIdsByItemId(
  links: Array<{ itemId: number; tagId: number }>,
): Map<number, Array<number>> {
  const tagIdsByItemId = new Map<number, Array<number>>();
  for (const link of links) {
    const tagIds = tagIdsByItemId.get(link.itemId) ?? [];
    tagIds.push(link.tagId);
    tagIdsByItemId.set(link.itemId, tagIds);
  }
  return tagIdsByItemId;
}

/** One entry per contact: a repeated address keeps its last entry. */
export function lastEntryPerContact(
  contacts: Array<ResolvedContact>,
): Array<ResolvedContact> {
  const lastByItemId = new Map<number, ResolvedContact>();
  for (const contact of contacts) {
    lastByItemId.set(contact.itemId, contact);
  }
  return Array.from(lastByItemId.values());
}

export function isSameSet(a: Array<number>, b: Array<number>): boolean {
  const set = new Set(a);
  return set.size === new Set(b).size && b.every((id) => set.has(id));
}

/** Every tag of the space is in the write's name map; a miss is a bug. */
export function nameOf(spaceTags: SpaceTags, tagId: number): string {
  const name = spaceTags.nameById.get(tagId);
  if (name === undefined) {
    throw new Error(`Tag ${tagId} is not a tag of the space being written`);
  }
  return name;
}
