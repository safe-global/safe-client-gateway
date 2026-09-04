// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import { z } from 'zod';
import {
  type CloudCosignerPolicy,
  CloudCosignerPolicySchema,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';

export class CloudCosignerPolicyDto implements CloudCosignerPolicy {
  @ApiProperty({
    type: Number,
    description:
      'Fiat value above which a proposed transaction goes to full review',
  })
  public readonly valueThresholdUsd!: number;

  @ApiProperty({
    type: Boolean,
    description:
      'Whether a first interaction with an unknown contract goes to full review',
  })
  public readonly reviewUnknownContracts!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Free-text rules handed to the reviewer',
  })
  public readonly instructions!: string | null;
}

export const UpdateCloudCosignerPolicySchema = z.object({
  policy: CloudCosignerPolicySchema,
  signer: AddressSchema,
  signature: SignatureSchema,
  issuedAt: z.iso.datetime().transform((value) => new Date(value)),
});

export class UpdateCloudCosignerPolicyDto
  implements z.input<typeof UpdateCloudCosignerPolicySchema>
{
  @ApiProperty({ type: CloudCosignerPolicyDto })
  public readonly policy!: CloudCosignerPolicyDto;

  @ApiProperty({
    type: String,
    description: 'Owner address that signed the policy message',
  })
  public readonly signer!: Address;

  @ApiProperty({
    type: String,
    description: 'EIP-191 signature over the canonical policy message',
  })
  public readonly signature!: Hex;

  @ApiProperty({
    type: String,
    description: 'ISO-8601 timestamp embedded in the signed message',
  })
  public readonly issuedAt!: string;
}
