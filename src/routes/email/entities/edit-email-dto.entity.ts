import { ApiProperty } from '@nestjs/swagger';

export class EditEmailDto {
  @ApiProperty()
  emailAddress!: string;
}
