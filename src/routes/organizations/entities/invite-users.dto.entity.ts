import { z } from 'zod';
import { UserOrganizationRole } from '@/domain/users/entities/user-organization.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { ApiProperty } from '@nestjs/swagger';

const InviteUserDtoSchema = z
  .array(
    z.object({
      address: AddressSchema,
      role: z.enum(getStringEnumKeys(UserOrganizationRole)),
    }),
  )
  .min(1);

export const InviteUsersDtoSchema = z.object({
  users: InviteUserDtoSchema,
});

class InviteUserDto {
  @ApiProperty()
  public readonly address!: `0x${string}`;

  @ApiProperty({
    enum: getStringEnumKeys(UserOrganizationRole),
  })
  public readonly role!: keyof typeof UserOrganizationRole;
}

export class InviteUsersDto implements z.infer<typeof InviteUsersDtoSchema> {
  @ApiProperty({
    type: InviteUserDto,
    isArray: true,
  })
  public readonly users!: Array<InviteUserDto>;
}
