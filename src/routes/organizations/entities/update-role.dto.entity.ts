import { z } from 'zod';
import { UserOrganizationRole } from '@/domain/users/entities/user-organization.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { ApiProperty } from '@nestjs/swagger';

export const UpdateRoleDtoSchema = z.object({
  role: z.enum(getStringEnumKeys(UserOrganizationRole)),
});

export class UpdateRoleDto implements z.infer<typeof UpdateRoleDtoSchema> {
  @ApiProperty({
    type: String,
    enum: getStringEnumKeys(UserOrganizationRole),
  })
  public readonly role!: keyof typeof UserOrganizationRole;
}
