import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import { DataDecoded as DomainDataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';

export class DataDecoded implements DomainDataDecoded {
  @ApiProperty()
  method: string;
  @ApiPropertyOptional({
    type: DataDecodedParameter,
    isArray: true,
    nullable: true,
  })
  parameters: DataDecodedParameter[] | null;

  constructor(method: string, parameters: DataDecodedParameter[] | null) {
    this.method = method;
    this.parameters = parameters;
  }
}
