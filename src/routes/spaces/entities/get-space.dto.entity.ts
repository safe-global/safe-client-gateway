import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { Member } from '@/datasources/users/entities/member.entity.db';
import { User } from '@/datasources/users/entities/users.entity.db';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { SpaceStatus } from '@/domain/spaces/entities/space.entity';
import {
  MemberRole,
  MemberStatus,
} from '@/domain/users/entities/member.entity';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

class UserDto extends User {
  @ApiProperty({ type: Number })
  public id!: User['id'];

  @ApiProperty({ type: String, enum: getStringEnumKeys(UserStatus) })
  public status!: User['status'];
}

class MemberDto {
  @ApiProperty({ type: Number })
  public id!: Member['id'];

  @ApiProperty({ type: String, enum: getStringEnumKeys(MemberRole) })
  public role!: Member['role'];

  @ApiProperty({ type: String })
  public name!: Member['name'];

  @ApiProperty({ type: String })
  public invitedBy!: Member['invitedBy'];

  @ApiProperty({
    type: String,
    enum: getStringEnumKeys(MemberStatus),
  })
  public status!: Member['status'];

  @ApiProperty({ type: Date })
  public createdAt!: Member['createdAt'];

  @ApiProperty({ type: Date })
  public updatedAt!: Member['updatedAt'];

  @ApiProperty({ type: UserDto })
  public user!: Partial<UserDto>;
}

export class GetSpaceResponse {
  @ApiProperty({ type: Number })
  public id!: Space['id'];

  @ApiProperty({ type: String })
  public name!: Space['name'];

  @ApiProperty({ type: String, enum: getStringEnumKeys(SpaceStatus) })
  public status!: keyof typeof SpaceStatus;

  @ApiProperty({ type: MemberDto, isArray: true })
  public members!: Array<MemberDto>;
}
