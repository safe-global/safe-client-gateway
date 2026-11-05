// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import { z } from 'zod';
import {
  MAX_POLICY_CONFIGURATIONS_PER_REQUEST,
  type PolicyConfiguration,
  PolicyConfigurationsSchema,
} from '#/modules/policies/domain/entities/policy-configuration.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import { HexSchema } from '#/validation/entities/schemas/hex.schema';

export const CreatePolicyConfigurationRequestSchema = z.object({
  root: HexSchema,
  configurations: PolicyConfigurationsSchema,
});

export const PolicyConfigurationRootSchema = HexSchema.refine(
  (root) => root.length === 66,
  { error: 'Invalid 32-byte hex' },
);

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
  @ApiProperty({ enum: Operation, description: '0 = CALL, 1 = DELEGATECALL' })
  public readonly operation!: Operation;
  @ApiProperty({
    description:
      'Policy contract to bind. The zero address removes the policy of this access.',
  })
  public readonly policy!: Address;
  @ApiProperty({
    description:
      'Policy payload, abi-encoded as passed to the guard. At most 64 KiB (65,536 bytes).',
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
  @ApiProperty({
    type: PolicyConfigurationDto,
    isArray: true,
    minItems: 1,
    maxItems: MAX_POLICY_CONFIGURATIONS_PER_REQUEST,
  })
  public readonly configurations!: [
    PolicyConfiguration,
    ...Array<PolicyConfiguration>,
  ];
}

export class CreatePolicyConfigurationRequestResponse {
  @ApiProperty({ description: 'The stored configuration root' })
  public readonly root!: Hex;
}
