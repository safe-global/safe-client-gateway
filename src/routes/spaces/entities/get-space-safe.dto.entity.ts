import type { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { ApiProperty } from '@nestjs/swagger';

export class GetSpaceSafeResponse {
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    example: {
      '{chainId}': ['0x...'],
    },
  })
  public readonly safes!: {
    [chainId: SpaceSafe['chainId']]: Array<SpaceSafe['address']>;
  };
}
