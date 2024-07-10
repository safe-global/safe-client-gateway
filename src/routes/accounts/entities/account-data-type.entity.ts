import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountDataType {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;
  @ApiProperty()
  isActive: boolean;

  constructor(
    id: string,
    name: string,
    description: string | null,
    isActive: boolean,
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.isActive = isActive;
  }
}
