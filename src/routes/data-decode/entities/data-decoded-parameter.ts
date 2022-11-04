import { ApiProperty } from '@nestjs/swagger';

export class DataDecodedParameter {
  @ApiProperty()
  name: string;
  @ApiProperty()
  paramType: string;
  @ApiProperty()
  value: unknown;
  @ApiProperty()
  valueDecoded?: Record<string, any> | Record<string, any>[] | undefined;
}
