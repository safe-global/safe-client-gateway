// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { type Address, type Hex, size } from 'viem';
import { z } from 'zod';
import {
  MAX_POLICY_CONFIGURATIONS_PER_REQUEST,
  type PolicyConfiguration,
  PolicyConfigurationsSchema,
} from '#/modules/policies/domain/entities/policy-configuration.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import { HexBytesSchema } from '#/validation/entities/schemas/hexbytes.schema';
import { SignatureSchema } from '#/validation/entities/schemas/signature.schema';

const Bytes32Schema = HexBytesSchema.refine((value) => size(value) === 32, {
  error: 'Invalid 32-byte hex',
});

export const PolicyConfigurationRootSchema = Bytes32Schema;

export const CreatePolicyConfigurationRequestSchema = z.object({
  configurations: PolicyConfigurationsSchema,
  safeTxHash: Bytes32Schema,
  signature: SignatureSchema,
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
    type: PolicyConfigurationDto,
    isArray: true,
    minItems: 1,
    maxItems: MAX_POLICY_CONFIGURATIONS_PER_REQUEST,
    description:
      'The configurations whose root, keccak256(abi.encode(Configuration[])), the Safe transaction requests',
  })
  public readonly configurations!: [
    PolicyConfiguration,
    ...Array<PolicyConfiguration>,
  ];
  @ApiProperty({
    description:
      "Hash of the queued Safe transaction calling requestConfiguration(root) on the Safe's policy guard",
  })
  public readonly safeTxHash!: Hex;
  @ApiProperty({
    description:
      "A current owner's signature of safeTxHash. A contract signature or approved hash must already be a confirmation of the queued transaction.",
  })
  public readonly signature!: Hex;
}

export class CreatePolicyConfigurationRequestResponse {
  @ApiProperty({ description: 'The stored configuration root' })
  public readonly root!: Hex;
}
