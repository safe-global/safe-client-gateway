import { ApiProperty } from '@nestjs/swagger';

export class DataDecodedParameter {
  @ApiProperty()
  name: string;
  @ApiProperty()
  type: string;
  @ApiProperty()
  value: unknown;
  @ApiProperty()
  valueDecoded?: Record<string, any> | Record<string, any>[] | undefined;

  constructor(
    name: string,
    type: string,
    value: unknown,
    valueDecoded: Record<string, any> | Record<string, any>[] | undefined,
  ) {
    this.name = name;
    this.type = type;
    this.value = value;
    this.valueDecoded = valueDecoded;
  }
}
