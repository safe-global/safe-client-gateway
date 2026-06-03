// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { MemberRole } from '@/modules/users/domain/entities/member.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import {
  type EmailAddress,
  EmailAddressSchema,
} from '@/validation/entities/schemas/email-address.schema';

export const InviteType = {
  Wallet: 'wallet',
  Email: 'email',
} as const;

const SharedInviteFields = {
  role: z.enum(getStringEnumKeys(MemberRole)),
  name: z.string().max(255),
};

const WalletInviteUserSchema = z
  .object({
    type: z.literal(InviteType.Wallet),
    address: AddressSchema,
    ...SharedInviteFields,
  })
  .strict();

const EmailInviteUserSchema = z
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

// Defaults missing `type` to wallet so legacy clients keep working.
// TODO: remove once wallet-1 wa-2052 ships.
const InviteUserSchemaWithWalletDefault = z.preprocess((raw) => {
  if (raw && typeof raw === 'object' && !('type' in raw)) {
    return { ...raw, type: InviteType.Wallet };
  }
  return raw;
}, InviteUserSchema);

export const InviteUsersDtoSchema = z.object({
  users: z.array(InviteUserSchemaWithWalletDefault).min(1),
});

class WalletInviteUserDto implements z.infer<typeof WalletInviteUserSchema> {
  @ApiProperty({ enum: [InviteType.Wallet] })
  public readonly type!: typeof InviteType.Wallet;

  @ApiProperty()
  public readonly address!: Address;

  @ApiProperty({ enum: getStringEnumKeys(MemberRole) })
  public readonly role!: keyof typeof MemberRole;

  @ApiProperty({ type: String, maxLength: 255 })
  public readonly name!: string;
}

class EmailInviteUserDto implements z.infer<typeof EmailInviteUserSchema> {
  @ApiProperty({ enum: [InviteType.Email] })
  public readonly type!: typeof InviteType.Email;

  @ApiProperty({ type: String, format: 'email', maxLength: 255 })
  public readonly email!: EmailAddress;

  @ApiProperty({ enum: getStringEnumKeys(MemberRole) })
  public readonly role!: keyof typeof MemberRole;

  @ApiProperty({ type: String, maxLength: 255 })
  public readonly name!: string;
}

@ApiExtraModels(WalletInviteUserDto, EmailInviteUserDto)
export class InviteUsersDto implements z.infer<typeof InviteUsersDtoSchema> {
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(WalletInviteUserDto) },
        { $ref: getSchemaPath(EmailInviteUserDto) },
      ],
    },
  })
  public readonly users!: Array<InviteUserInput>;
}
