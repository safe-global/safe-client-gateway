import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  BaseDataDecoded as DomainBaseDataDecoded,
  MultiSend as DomainMultiSend,
  DataDecoded as DomainDataDecoded,
  DataDecodedParameter as DomainDataDecodedParameter,
  DataDecodedAccuracy,
} from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';

class BaseDataDecoded implements DomainBaseDataDecoded {
  @ApiProperty()
  method!: string;

  @ApiPropertyOptional({ type: () => DataDecodedParameter, isArray: true })
  parameters!: Array<DataDecodedParameter> | null;
}

class MultiSend implements DomainMultiSend {
  @ApiProperty({ enum: Operation })
  operation!: Operation;

  @ApiProperty()
  value!: string;

  @ApiPropertyOptional({ type: () => BaseDataDecoded })
  dataDecoded!: BaseDataDecoded;

  @ApiProperty()
  to!: `0x${string}`;

  @ApiPropertyOptional()
  data!: `0x${string}` | null;
}

@ApiExtraModels(MultiSend, BaseDataDecoded)
export class DataDecodedParameter implements DomainDataDecodedParameter {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  value!: Required<unknown>;

  @ApiPropertyOptional({
    oneOf: [
      { $ref: getSchemaPath(BaseDataDecoded) },
      { type: 'array', items: { $ref: getSchemaPath(MultiSend) } },
      { type: 'null' },
    ],
  })
  valueDecoded?: Array<DomainMultiSend> | DomainBaseDataDecoded | null;
}

export class DataDecoded implements DomainDataDecoded {
  @ApiProperty()
  method!: string;

  @ApiPropertyOptional({
    type: DataDecodedParameter,
    isArray: true,
    nullable: true,
  })
  parameters!: Array<DataDecodedParameter> | null;

  @ApiPropertyOptional({
    enum: [...DataDecodedAccuracy, 'UNKNOWN'],
    default: 'UNKNOWN',
  })
  accuracy!: (typeof DataDecodedAccuracy)[number] | 'UNKNOWN';
}
