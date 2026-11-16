// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '#/datasources/db/v2/entities/row.entity';
import { TagColorSchema } from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { SpaceSchema } from '#/modules/spaces/domain/entities/space.entity';

// Explicit ZodType because of the Space recursion, as in address-book-item.db.entity.ts.
export const AddressBookTagDbItemSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    space: Space;
    name: string;
    nameIndex: string;
    color: z.infer<typeof TagColorSchema>;
    createdBy: number;
  }
> = RowSchema.extend({
  space: z.lazy(() => SpaceSchema),
  name: z.string(),
  nameIndex: z.string(),
  color: TagColorSchema,
  createdBy: z.number().int().positive(),
});

export type AddressBookTagDbItem = z.infer<typeof AddressBookTagDbItemSchema>;

export const AddressBookItemTagDbItemSchema = RowSchema.extend({
  itemId: z.number().int().positive(),
  tagId: z.number().int().positive(),
});

export type AddressBookItemTagDbItem = z.infer<
  typeof AddressBookItemTagDbItemSchema
>;
