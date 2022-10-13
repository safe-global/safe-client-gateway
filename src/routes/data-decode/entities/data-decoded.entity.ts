import { ApiProperty } from '@nestjs/swagger';
import {
  DataDecoded as DomainDataDecoded,
  DataDecodedParameter,
} from '../../../domain/data-decoder/entities/data-decoded.entity';

export class DataDecoded implements DomainDataDecoded {
  @ApiProperty()
  method: string;
  @ApiProperty()
  parameters?: DataDecodedParameter[] | undefined;
}
