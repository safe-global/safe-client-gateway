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
} from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { Address, Hex } from 'viem';

class BaseDataDecoded implements DomainBaseDataDecoded {
  @ApiProperty()
  method!: string;

  @ApiPropertyOptional({ type: () => DataDecodedParameter, isArray: true })
  parameters!: Array<DataDecodedParameter> | null;
}

class MultiSend implements DomainMultiSend {
  @ApiProperty({
    enum: Operation,
    enumName: 'Operation',
    description: 'Operation type: 0 for CALL, 1 for DELEGATE',
  })
  operation!: Operation;

  @ApiProperty()
  value!: string;

  @ApiPropertyOptional({ type: () => BaseDataDecoded })
  dataDecoded!: BaseDataDecoded;

  @ApiProperty()
  to!: Address;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Hexadecimal encoded data',
    pattern: '^0x[0-9a-fA-F]*$',
  })
  data!: Hex | null;
}

@ApiExtraModels(MultiSend, BaseDataDecoded)
export class DataDecodedParameter implements DomainDataDecodedParameter {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty({
    description:
      'Parameter value - typically a string, but may be an array of strings for array types (e.g., address[], uint256[])',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
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
