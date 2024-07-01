import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountDataType {
  @ApiProperty()
  accountDataTypeId: string;
  @ApiProperty()
  name: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  constructor(
    accountDataTypeId: string,
    name: string,
    description: string | null,
  ) {
    this.accountDataTypeId = accountDataTypeId;
    this.name = name;
    this.description = description;
  }
}
