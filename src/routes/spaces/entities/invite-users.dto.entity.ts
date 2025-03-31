import { z } from 'zod';
import { MemberRole } from '@/domain/users/entities/member.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { ApiProperty } from '@nestjs/swagger';
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from '@/domain/common/entities/name.schema';

const InviteUserDtoSchema = z
  .array(
    z.object({
      address: AddressSchema,
      role: z.enum(getStringEnumKeys(MemberRole)),
      name: z.string().max(255),
    }),
  )
  .min(1);

export const InviteUsersDtoSchema = z.object({
  users: InviteUserDtoSchema,
});

export class InviteUserDto {
  @ApiProperty()
  public readonly address!: `0x${string}`;

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
