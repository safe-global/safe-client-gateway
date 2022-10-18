import { ApiProperty } from '@nestjs/swagger';

export class CreateDataDecodedDto {
  @ApiProperty()
  data: string;
  @ApiProperty()
  to: string;

  constructor(data: string, to: string) {
    this.data = data;
    this.to = to;
  }
}

export function isCreateDataDecodeDto(
  dto: CreateDataDecodedDto,
): dto is CreateDataDecodedDto {
  return isHex(dto.data) && isHex(dto.to);
}

function isHex(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('0x');
}
