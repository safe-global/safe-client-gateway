// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import z from 'zod';

const DeleteCounterfactualSafeSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

export const DeleteCounterfactualSafesSchema = z.object({
  safes: z.array(DeleteCounterfactualSafeSchema).nonempty().max(100),
});

export class DeleteCounterfactualSafeDto
  implements z.infer<typeof DeleteCounterfactualSafeSchema>
{
  @ApiProperty({ type: String })
  public readonly chainId!: CounterfactualSafe['chainId'];

  @ApiProperty({ type: String })
  public readonly address!: CounterfactualSafe['address'];
}

export class DeleteCounterfactualSafesDto
  implements z.infer<typeof DeleteCounterfactualSafesSchema>
{
  @ApiProperty({ type: DeleteCounterfactualSafeDto, isArray: true })
  public readonly safes!: [
    DeleteCounterfactualSafeDto,
    ...Array<DeleteCounterfactualSafeDto>,
  ];
}
