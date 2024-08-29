import { DataDecodedParameter as DomainDataDecodedParameter } from '@/domain/data-decoder/entities/data-decoded.entity';
import { ApiProperty } from '@nestjs/swagger';

export class DataDecodedParameter implements DomainDataDecodedParameter {
  @ApiProperty()
  name: string;
  @ApiProperty()
  type: string;
  @ApiProperty()
  value: Required<unknown>;
  @ApiProperty()
  valueDecoded: Record<string, unknown> | Record<string, unknown>[] | null;

  constructor(
    name: string,
    type: string,
    value: Required<unknown>,
    valueDecoded: Record<string, unknown> | Record<string, unknown>[] | null,
  ) {
    this.name = name;
    this.type = type;
    this.value = value;
    this.valueDecoded = valueDecoded;
  }
}
