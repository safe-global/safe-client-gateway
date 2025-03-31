import { TypedData as DomainTypedData } from '@/domain/messages/entities/typed-data.entity';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

class TypedDataDomain {
  @ApiPropertyOptional({ type: Number })
  chainId?: number;

  @ApiPropertyOptional({
    type: String,
  })
  name?: string;

  @ApiPropertyOptional({ type: String })
  salt?: `0x${string}`;

  @ApiPropertyOptional({
    type: String,
  })
  verifyingContract?: `0x${string}`;

  @ApiPropertyOptional({
    type: String,
  })
  version?: string;
}

class TypedDataParameter {
  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  type!: string;
}

@ApiExtraModels(TypedDataParameter)
export class TypedData implements DomainTypedData {
  @ApiProperty({ type: TypedDataDomain })
  domain!: TypedDataDomain;

  @ApiProperty({ type: String })
  primaryType!: string;

  @ApiProperty({
    type: Object,
    additionalProperties: {
      items: { $ref: getSchemaPath(TypedDataParameter) },
      type: 'array',
    },
  })
  types!: Record<string, Array<TypedDataParameter>>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  message!: Record<string, unknown>;
}
