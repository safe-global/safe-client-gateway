// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import { z } from 'zod';
import {
  type PolicyConfiguration,
  PolicyConfigurationsSchema,
} from '@/modules/policies/domain/entities/policy-configuration.entity';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const CreatePolicyConfigurationRequestSchema = z.object({
  /**
   * The root as submitted on-chain. Recomputed from `configurations` and
   * rejected on mismatch, so a client encoding bug fails loudly instead of
   * storing a configuration that explains nothing.
   */
  root: HexSchema,
  configurations: PolicyConfigurationsSchema,
});

export type CreatePolicyConfigurationRequestPayload = z.infer<
  typeof CreatePolicyConfigurationRequestSchema
>;

export class PolicyConfigurationDto implements PolicyConfiguration {
  @ApiProperty({ description: 'Contract the guarded call targets' })
  public readonly target!: Address;
  @ApiProperty({
    description: '4-byte function selector',
    example: '0xa9059cbb',
  })
  public readonly selector!: Hex;
  @ApiProperty({ enum: [0, 1], description: '0 = CALL, 1 = DELEGATECALL' })
  public readonly operation!: 0 | 1;
  @ApiProperty({
    description:
      'Policy contract to bind. The zero address removes the policy of this access.',
  })
  public readonly policy!: Address;
  @ApiProperty({
    description: 'Policy payload, abi-encoded as passed to the guard',
  })
  public readonly data!: Hex;
}

export class CreatePolicyConfigurationRequestDto
  implements CreatePolicyConfigurationRequestPayload
{
  @ApiProperty({
    description:
      'keccak256(abi.encode(Configuration[])), as requested on-chain',
  })
  public readonly root!: Hex;
  @ApiProperty({ type: PolicyConfigurationDto, isArray: true })
  public readonly configurations!: [
    PolicyConfiguration,
    ...Array<PolicyConfiguration>,
  ];
}

export class CreatePolicyConfigurationRequestResponse {
  @ApiProperty({ description: 'The stored configuration root' })
  public readonly configureRoot!: Hex;
}
