// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NameSchema,
} from '@/domain/common/schemas/name.schema';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { MemberRole } from '@/modules/users/domain/entities/member.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

const SharedInviteFields = {
  role: z.enum(getStringEnumKeys(MemberRole)),
  name: NameSchema,
};

const InviteUserSchema = z.union([
  z.object({ address: AddressSchema, ...SharedInviteFields }).strict(),
  z.object({ email: z.email().max(255), ...SharedInviteFields }).strict(),
]);

const InviteUserDtoSchema = z.array(InviteUserSchema).min(1);

export const InviteUsersDtoSchema = z.object({
  users: InviteUserDtoSchema,
});

export class InviteUserDto {
  @ApiPropertyOptional({
    description:
      'Wallet address to invite. Provide either address or email, but not both.',
  })
  public readonly address?: Address;

  @ApiPropertyOptional({
    description:
      'Email address to invite. Provide either email or address, but not both.',
  })
  public readonly email?: string;

  @ApiProperty({
    type: String,
    minLength: NAME_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
  })
  public readonly name!: string;

  @ApiProperty({
    enum: getStringEnumKeys(MemberRole),
  })
  public readonly role!: keyof typeof MemberRole;
}

export class InviteUsersDto {
  @ApiProperty({
    type: InviteUserDto,
    isArray: true,
  })
  public readonly users!: Array<InviteUserDto>;
}
