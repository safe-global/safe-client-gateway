import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';

export class DataDecoded {
  @ApiProperty()
  method: string;
  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  constructor(method: string, parameters: DataDecodedParameter[] | null) {
    this.method = method;
    this.parameters = parameters;
  }
}
