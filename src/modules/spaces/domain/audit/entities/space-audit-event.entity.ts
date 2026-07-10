// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';
import { MemberRole } from '@/modules/users/domain/entities/member.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

/**
 * Event taxonomy of the append-only space audit log.
 *
 * Payloads are additive-only: rows are immutable, so a shape can gain
 * optional fields but semantic changes require a new event type. The web
 * app mirrors these shapes in its audit event copy.
 */

export enum SpaceAuditEventType {
  SPACE_CREATED = 'SPACE_CREATED',
  SPACE_UPDATED = 'SPACE_UPDATED',
  SPACE_DELETED = 'SPACE_DELETED',
  MEMBER_INVITED = 'MEMBER_INVITED',
  MEMBER_INVITE_ACCEPTED = 'MEMBER_INVITE_ACCEPTED',
  MEMBER_INVITE_DECLINED = 'MEMBER_INVITE_DECLINED',
  MEMBER_INVITE_RENEWED = 'MEMBER_INVITE_RENEWED',
  MEMBER_ROLE_UPDATED = 'MEMBER_ROLE_UPDATED',
  MEMBER_ALIAS_UPDATED = 'MEMBER_ALIAS_UPDATED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  MEMBER_LEFT = 'MEMBER_LEFT',
  SAFE_ADDED = 'SAFE_ADDED',
  SAFE_REMOVED = 'SAFE_REMOVED',
  ADDRESS_BOOK_UPSERTED = 'ADDRESS_BOOK_UPSERTED',
  ADDRESS_BOOK_DELETED = 'ADDRESS_BOOK_DELETED',
}

export const SpaceAuditEventTypeSchema = z.enum(
  getStringEnumKeys(SpaceAuditEventType),
);

/**
 * A KMS field-encryption ciphertext (`kms:v1:<base64url>`). Audit payloads carry
 * the source row's stored value, which is ciphertext once field encryption is
 * enabled (contract pattern 5), so address members accept it alongside a
 * plaintext checksummed address. Name members are already `z.string()`.
 */
const KmsCiphertextSchema = z.string().regex(/^kms:v1:[A-Za-z0-9_-]+$/);
const AuditAddressSchema = z.union([AddressSchema, KmsCiphertextSchema]);

const UserIdSchema = z.number().int().positive();

const SpaceFieldsSchema = z.object({
  name: z.string().optional(),
  status: z.enum(getStringEnumKeys(SpaceStatus)).optional(),
});

const SpaceSafeSchema = z.object({
  chainId: NumericStringSchema,
  address: AuditAddressSchema,
});

const AddressBookEntrySchema = z.object({
  address: AuditAddressSchema,
  name: z.string(),
});

export const SpaceCreatedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.SPACE_CREATED),
  payload: z.object({ name: z.string() }),
});

export const SpaceUpdatedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.SPACE_UPDATED),
  payload: z.object({ old: SpaceFieldsSchema, new: SpaceFieldsSchema }),
});

export const SpaceDeletedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.SPACE_DELETED),
  payload: z.object({ name: z.string() }),
});

export const MemberInvitedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.MEMBER_INVITED),
  payload: z.object({
    targetUserId: UserIdSchema,
    role: z.enum(getStringEnumKeys(MemberRole)),
    reinvite: z.boolean().optional(),
  }),
});

export const MemberInviteAcceptedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.MEMBER_INVITE_ACCEPTED),
  payload: z.object({ targetUserId: UserIdSchema }),
});

export const MemberInviteDeclinedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.MEMBER_INVITE_DECLINED),
  payload: z.object({ targetUserId: UserIdSchema }),
});

export const MemberInviteRenewedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.MEMBER_INVITE_RENEWED),
  payload: z.object({ targetUserId: UserIdSchema }),
});

export const MemberRoleUpdatedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.MEMBER_ROLE_UPDATED),
  payload: z.object({
    targetUserId: UserIdSchema,
    oldRole: z.enum(getStringEnumKeys(MemberRole)),
    newRole: z.enum(getStringEnumKeys(MemberRole)),
  }),
});

export const MemberAliasUpdatedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.MEMBER_ALIAS_UPDATED),
  payload: z.object({ targetUserId: UserIdSchema }),
});

export const MemberRemovedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.MEMBER_REMOVED),
  payload: z.object({
    targetUserId: UserIdSchema,
    accountDeleted: z.boolean().optional(),
  }),
});

export const MemberLeftEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.MEMBER_LEFT),
  payload: z.object({
    targetUserId: UserIdSchema,
    accountDeleted: z.boolean().optional(),
  }),
});

export const SafeAddedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.SAFE_ADDED),
  payload: z.object({ safes: z.array(SpaceSafeSchema) }),
});

export const SafeRemovedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.SAFE_REMOVED),
  payload: z.object({ safes: z.array(SpaceSafeSchema) }),
});

export const AddressBookUpsertedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.ADDRESS_BOOK_UPSERTED),
  payload: z.object({
    created: z.array(AddressBookEntrySchema),
    updated: z.array(AddressBookEntrySchema),
    onBehalfOfUserId: UserIdSchema.optional(),
  }),
});

export const AddressBookDeletedEventSchema = z.object({
  eventType: z.literal(SpaceAuditEventType.ADDRESS_BOOK_DELETED),
  payload: z.object({
    address: AuditAddressSchema,
    name: z.string(),
  }),
});

export const SpaceAuditEventSchema = z.discriminatedUnion('eventType', [
  SpaceCreatedEventSchema,
  SpaceUpdatedEventSchema,
  SpaceDeletedEventSchema,
  MemberInvitedEventSchema,
  MemberInviteAcceptedEventSchema,
  MemberInviteDeclinedEventSchema,
  MemberInviteRenewedEventSchema,
  MemberRoleUpdatedEventSchema,
  MemberAliasUpdatedEventSchema,
  MemberRemovedEventSchema,
  MemberLeftEventSchema,
  SafeAddedEventSchema,
  SafeRemovedEventSchema,
  AddressBookUpsertedEventSchema,
  AddressBookDeletedEventSchema,
]);

export type SpaceAuditEvent = z.infer<typeof SpaceAuditEventSchema>;

export type SpaceAuditEventPayload = SpaceAuditEvent['payload'];

export type SpaceUpdatedPayload = z.infer<
  typeof SpaceUpdatedEventSchema
>['payload'];
