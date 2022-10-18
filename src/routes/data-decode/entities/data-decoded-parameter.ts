import { ApiProperty } from '@nestjs/swagger';

export class DataDecodedParameter {
  @ApiProperty()
  name: string;
  @ApiProperty()
  paramType: string;
  @ApiProperty()
  value: string | number;
  @ApiProperty()
  valueDecoded?: Record<string, any> | Record<string, any>[] | undefined;
}
