import { ApiProperty } from '@nestjs/swagger';

export class UserSession {
  @ApiProperty()
  id?: string;
}
