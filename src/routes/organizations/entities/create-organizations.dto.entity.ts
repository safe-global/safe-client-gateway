import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationResponse {
  @ApiProperty()
  name!: string;
}
