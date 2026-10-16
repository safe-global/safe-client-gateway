// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { sanitizeName } from '#/domain/common/schemas/name.schema';

export const TAG_COLORS = [
  'green',
  'blue',
  'orange',
  'red',
  'teal',
  'gold',
  'violet',
  'graphite',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const TagColorSchema = z.enum(TAG_COLORS);

export const MAX_TAGS_PER_CONTACT = 3;
export const MAX_TAGS_PER_WORKSPACE = TAG_COLORS.length;
export const TAG_NAME_MAX_LENGTH = 32;

export const WORKSPACE_TAG_LIMIT_MESSAGE = `Your workspace has ${MAX_TAGS_PER_WORKSPACE} tags. Rename or delete one to add another.`;

const ALLOWED_TAG_NAME = /^[\p{L}\p{M}\p{N} \-_&/]+$/u;
const FORBIDDEN_TAG_PREFIX = /^[=+\-@]/;

export const TagNameSchema = z
  .string()
  // Runs of spaces collapse to one, so names that render the same are one tag
  // (SpaceEncryptionService.tagNameIndex collapses them the same way).
  .transform((name) => sanitizeName(name).replace(/ {2,}/g, ' '))
  .superRefine((name, ctx) => {
    const length = [...name].length;
    if (length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Tags cannot be empty' });
      return;
    }
    if (length > TAG_NAME_MAX_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        message: `Tags must be at most ${TAG_NAME_MAX_LENGTH} characters long`,
      });
      return;
    }
    if (FORBIDDEN_TAG_PREFIX.test(name)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Tags cannot start with =, +, - or @',
      });
      return;
    }
    if (!ALLOWED_TAG_NAME.test(name)) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Tags can only contain letters, numbers, spaces and the characters - _ & /',
      });
    }
  });

/** Case-insensitive dedupe keeping the first spelling, then the per-contact limit. */
export const TagNamesSchema = z
  .array(TagNameSchema)
  .transform((names) => {
    const seen = new Set<string>();
    return names.filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  })
  .refine((names) => names.length <= MAX_TAGS_PER_CONTACT, {
    message: `A contact can have at most ${MAX_TAGS_PER_CONTACT} tags`,
  });

export type TagNames = z.infer<typeof TagNamesSchema>;

export const AddressBookTagSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  color: TagColorSchema,
  contactCount: z.number().int().nonnegative(),
});

export type AddressBookTag = z.infer<typeof AddressBookTagSchema>;
