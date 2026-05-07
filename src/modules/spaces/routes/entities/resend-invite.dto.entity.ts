// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const ResendInviteDtoSchema = z.union([
  z.object({ address: AddressSchema }).strict(),
  z.object({ email: z.email().max(255) }).strict(),
]);

export class ResendInviteDto {
  @ApiPropertyOptional()
  public readonly address?: Address;

  @ApiPropertyOptional()
  public readonly email?: string;
}
