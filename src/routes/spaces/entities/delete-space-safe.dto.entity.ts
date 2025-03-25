import { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { ChainIdSchema } from '@/domain/chains/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

const DeleteSpaceSafeSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

export const DeleteSpaceSafesSchema = z.object({
  safes: z.array(DeleteSpaceSafeSchema).nonempty(),
});

export class DeleteSpaceSafeDto
  implements z.infer<typeof DeleteSpaceSafeSchema>
{
  @ApiProperty({ type: String })
  public readonly chainId!: SpaceSafe['chainId'];

  @ApiProperty({ type: String })
  public readonly address!: SpaceSafe['address'];
}

export class DeleteSpaceSafesDto
  implements z.infer<typeof DeleteSpaceSafesSchema>
{
  @ApiProperty({ type: DeleteSpaceSafeDto, isArray: true })
  public readonly safes!: [DeleteSpaceSafeDto, ...Array<DeleteSpaceSafeDto>];
}
