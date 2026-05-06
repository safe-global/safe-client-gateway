// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const ResendInviteDtoSchema = z
  .object({
    address: AddressSchema.optional(),
    email: z.email().max(255).optional(),
  })
  .superRefine((value, ctx) => {
    const identifiers = [value.address, value.email].filter(Boolean);

    if (identifiers.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Exactly one of address or email is required.',
      });
    }
  });

export class ResendInviteDto implements z.infer<typeof ResendInviteDtoSchema> {
  @ApiPropertyOptional()
  public readonly address?: Address;

  @ApiPropertyOptional()
  public readonly email?: string;
}
