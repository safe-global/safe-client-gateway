import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';

interface Baseline {
  method: string;
  parameters: DataDecodedParameter[] | null;
}

enum DecodedType {
  Generic = 'GENERIC',
}

export class ConfirmationView implements Baseline {
  @ApiProperty()
  type = DecodedType.Generic;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
  }
}
