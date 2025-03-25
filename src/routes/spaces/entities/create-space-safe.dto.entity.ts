import { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { ChainIdSchema } from '@/domain/chains/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ApiProperty } from '@nestjs/swagger';

import { z } from 'zod';

const CreateSpaceSafeSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

export const CreateSpaceSafesSchema = z.object({
  safes: z.array(CreateSpaceSafeSchema).nonempty(),
});

export class CreateSpaceSafeDto
  implements z.infer<typeof CreateSpaceSafeSchema>
{
  @ApiProperty({ type: String })
  public readonly chainId!: SpaceSafe['chainId'];

  @ApiProperty({ type: String })
  public readonly address!: SpaceSafe['address'];
}

export class CreateSpaceSafesDto
  implements z.infer<typeof CreateSpaceSafesSchema>
{
  @ApiProperty({ type: CreateSpaceSafeDto, isArray: true })
  public readonly safes!: [CreateSpaceSafeDto, ...Array<CreateSpaceSafeDto>];
}
