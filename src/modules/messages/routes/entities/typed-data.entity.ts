import { TypedData as DomainTypedData } from '@/modules/messages/domain/entities/typed-data.entity';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Address } from 'viem';

class TypedDataDomain {
  @ApiPropertyOptional({ type: Number })
  chainId?: number;

  @ApiPropertyOptional({
    type: String,
  })
  name?: string;

  @ApiPropertyOptional({ type: String })
  salt?: Address;

  @ApiPropertyOptional({
    type: String,
  })
  verifyingContract?: Address;

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
