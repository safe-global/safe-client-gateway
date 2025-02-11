import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { UserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import { User } from '@/datasources/users/entities/users.entity.db';
import { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import {
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

class UserDto extends User {
  @ApiProperty({ type: Number })
  public id!: User['id'];

  @ApiProperty({ enum: UserStatus, type: Number })
  public status!: User['status'];
}

class UserOrganizationsDto {
  @ApiProperty({ type: Number })
  public id!: UserOrganization['id'];

  @ApiProperty({ type: Number, enum: UserOrganizationRole })
  public role!: UserOrganization['role'];

  @ApiProperty({ type: Number, enum: UserOrganizationStatus })
  public status!: UserOrganization['status'];

  @ApiProperty({ type: Date })
  public createdAt!: UserOrganization['createdAt'];

  @ApiProperty({ type: Date })
  public updatedAt!: UserOrganization['updatedAt'];

  @ApiProperty({ type: UserDto })
  public user!: UserDto;
}

export class GetOrganizationResponse {
  @ApiProperty({ type: Number })
  public id!: Organization['id'];

  @ApiProperty({ type: String })
  public name!: Organization['name'];

  @ApiProperty({ type: Number, enum: OrganizationStatus })
  public status!: Organization['status'];

  @ApiProperty()
  public userOrganizations!: Array<UserOrganizationsDto>;
}
