import { ApiProperty } from '@nestjs/swagger';
import type { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import z from 'zod';

const SpaceSafeSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

export const SpaceSafesSchema = z.object({
  safes: z.array(SpaceSafeSchema).nonempty(),
});

export class SpaceSafeDto
  implements
    Pick<SpaceSafe, 'chainId' | 'address'>,
    z.infer<typeof SpaceSafeSchema>
{
  @ApiProperty({ type: String })
  public readonly chainId!: SpaceSafe['chainId'];

  @ApiProperty({ type: String })
  public readonly address!: SpaceSafe['address'];
}

export class SpaceSafesDto implements z.infer<typeof SpaceSafesSchema> {
  @ApiProperty({ type: SpaceSafeDto, isArray: true })
  public readonly safes!: [SpaceSafeDto, ...Array<SpaceSafeDto>];
}
