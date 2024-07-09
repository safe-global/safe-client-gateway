import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountDataType {
  @ApiProperty()
  dataTypeId: string;
  @ApiProperty()
  name: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;
  @ApiProperty()
  isActive: boolean;

  constructor(
    dataTypeId: string,
    name: string,
    description: string | null,
    isActive: boolean,
  ) {
    this.dataTypeId = dataTypeId; // TODO: rename as 'id'
    this.name = name;
    this.description = description;
    this.isActive = isActive;
  }
}
