import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from './data-decoded-parameter.entity';

export class DataDecoded {
  @ApiProperty()
  method: string;
  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  humanDescription: string | null;

  constructor(
    method: string,
    parameters: DataDecodedParameter[] | null,
    humanDescription: string | null,
  ) {
    this.method = method;
    this.parameters = parameters;
    this.humanDescription = humanDescription;
  }
}
