import { z } from 'zod';
import { UserOrganizationRole as MemberRole } from '@/domain/users/entities/user-organization.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { ApiProperty } from '@nestjs/swagger';

export const UpdateRoleDtoSchema = z.object({
  role: z.enum(getStringEnumKeys(MemberRole)),
});

export class UpdateRoleDto implements z.infer<typeof UpdateRoleDtoSchema> {
  @ApiProperty({
    type: String,
    enum: getStringEnumKeys(MemberRole),
  })
  public readonly role!: keyof typeof MemberRole;
}
