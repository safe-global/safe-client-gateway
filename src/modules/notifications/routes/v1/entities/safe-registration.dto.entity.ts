// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { type Address, isAddress } from 'viem';
import { z } from 'zod';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';

export const SafeRegistrationSchema = z.object({
  chainId: ChainIdSchema,
  // Not checksummed: clients sign the addresses exactly as they send them
  safes: z.array(
    z.string().refine((value) => isAddress(value, { strict: false }), {
      error: 'Invalid address',
    }),
  ),
  // Plain strings: '' means unsigned, malformed values are rejected (422) at recovery
  signatures: z.array(z.string()),
});

export class SafeRegistration
  implements z.infer<typeof SafeRegistrationSchema>
{
  @ApiProperty()
  chainId!: string;
  @ApiProperty({ type: [String] })
  safes!: Array<Address>;
  @ApiProperty()
  signatures!: Array<string>;
}
