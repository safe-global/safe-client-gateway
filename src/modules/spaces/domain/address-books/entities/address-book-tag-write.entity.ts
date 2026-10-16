// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import { z } from 'zod';
import { RowSchema } from '#/datasources/db/v2/entities/row.entity';
import type { TagColor } from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import { UuidSchema } from '#/validation/entities/schemas/uuid.schema';

/** The driver hands raw rows back untyped, so the lock read parses. */
export const LockedSpaceRowsSchema = z.array(
  z.object({ id: RowSchema.shape.id, uuid: UuidSchema }),
);
export const InsertedIdSchema = z.object({ id: RowSchema.shape.id });

export type LockedSpace = z.infer<typeof LockedSpaceRowsSchema>[number];

/**
 * One write's view of the space's tags: loaded once after taking the lock,
 * names decrypted once, and tags created by the write added as they are made.
 */
export type SpaceTags = {
  idByIndex: Map<string, number>;
  nameById: Map<number, string>;
  usedColors: Set<TagColor>;
};

/** A contact whose tag set a write changes. */
export type ContactTagChange = {
  itemId: number;
  address: Address;
  oldTagIds: Array<number>;
  newTagIds: Array<number>;
};
