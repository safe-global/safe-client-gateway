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

const InviteUserSchema = z
  .object({
    address: AddressSchema.optional(),
    email: z.email().max(255).optional(),
    role: z.enum(getStringEnumKeys(MemberRole)),
    name: NameSchema,
  })
  .superRefine((value, ctx) => {
    const identifiers = [value.address, value.email].filter(Boolean);

    if (identifiers.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Exactly one of address or email is required.',
      });
    }
  });

const InviteUserDtoSchema = z.array(InviteUserSchema).min(1);

export const InviteUsersDtoSchema = z.object({
  users: InviteUserDtoSchema,
});

export class InviteUserDto {
  @ApiPropertyOptional()
  public readonly address?: Address;

  @ApiPropertyOptional()
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

export class InviteUsersDto implements z.infer<typeof InviteUsersDtoSchema> {
  @ApiProperty({
    type: InviteUserDto,
    isArray: true,
  })
  public readonly users!: Array<InviteUserDto>;
}
