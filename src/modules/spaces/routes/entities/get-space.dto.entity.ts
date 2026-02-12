import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import {
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';
import { ApiProperty } from '@nestjs/swagger';

class UserDto extends User {
  @ApiProperty({ type: Number })
  declare public id: User['id'];
}

class MemberDto {
  @ApiProperty({ type: String, enum: getStringEnumKeys(MemberRole) })
  public role!: Member['role'];

  @ApiProperty({ type: String })
  public invitedBy!: Member['invitedBy'];

  @ApiProperty({
    type: String,
    enum: getStringEnumKeys(MemberStatus),
  })
  public status!: Member['status'];

  @ApiProperty({ type: UserDto })
  public user!: Partial<UserDto>;
}

export class GetSpaceResponse {
  @ApiProperty({ type: Number })
  public id!: Space['id'];

  @ApiProperty({ type: String })
  public name!: Space['name'];

  @ApiProperty({ type: MemberDto, isArray: true })
  public members!: Array<MemberDto>;

  @ApiProperty({
    type: Number,
    description: 'Total count of Safes in the space',
    example: 5,
  })
  public safeCount!: number;
}
