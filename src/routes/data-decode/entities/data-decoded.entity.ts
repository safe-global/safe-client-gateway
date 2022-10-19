import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from './data-decoded-parameter';

export class DataDecoded {
  @ApiProperty()
  method: string;
  @ApiPropertyOptional({ type: [DataDecodedParameter] })
  parameters?: DataDecodedParameter[];
}
