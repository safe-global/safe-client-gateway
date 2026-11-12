// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { makeNameSchema } from '#/domain/common/schemas/name.schema';
import { getStringEnumKeys } from '#/domain/common/utils/enum';
import {
  MEMBER_NAME_MAX_LENGTH,
  MemberRole,
} from '#/modules/users/domain/entities/member.entity';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { EmailAddressSchema } from '#/validation/entities/schemas/email-address.schema';

export const InviteType = {
  Wallet: 'wallet',
  Email: 'email',
} as const;

const SharedInviteFields = {
  role: z.enum(getStringEnumKeys(MemberRole)),
  name: makeNameSchema({ maxLength: MEMBER_NAME_MAX_LENGTH }),
};

export const WalletInviteUserSchema = z
  .object({
    type: z.literal(InviteType.Wallet),
    address: AddressSchema,
    ...SharedInviteFields,
  })
  .strict();

export const EmailInviteUserSchema = z
  .object({
    type: z.literal(InviteType.Email),
    email: EmailAddressSchema,
    ...SharedInviteFields,
  })
  .strict();

export const InviteUserSchema = z.discriminatedUnion('type', [
  WalletInviteUserSchema,
  EmailInviteUserSchema,
]);

export type InviteUserInput = z.infer<typeof InviteUserSchema>;
export type EmailInviteUserInput = z.infer<typeof EmailInviteUserSchema>;
