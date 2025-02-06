import { UserStatus } from '@/domain/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

// @todo read from user
class UserDto {
  @ApiProperty()
  public id!: number;

  @ApiProperty()
  public status!: UserStatus;
}

class UserOrganizationsDto {
  @ApiProperty()
  public id!: number;

  @ApiProperty()
  public role!: number;

  @ApiProperty()
  public status!: number;

  @ApiProperty()
  public created_at!: Date;

  @ApiProperty()
  public updated_at!: Date;

  @ApiProperty()
  public user!: UserDto;
}

export class GetOrganizationResponse {
  @ApiProperty()
  public id!: number;

  @ApiProperty()
  public name!: string;

  @ApiProperty()
  public status!: number;

  @ApiProperty()
  public user_organizations!: Array<UserOrganizationsDto>;
}
