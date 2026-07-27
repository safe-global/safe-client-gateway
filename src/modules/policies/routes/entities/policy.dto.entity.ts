// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import type {
  ActivePolicy,
  ActivePolicyData,
  CosignerPolicyData,
  Erc20TransferPolicyData,
  NamedAddress,
  PendingPolicy,
  PolicyTokenInfo,
  RecoveryPolicyData,
  SpendingLimitPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type { AvailablePolicy } from '@/modules/policies/domain/entities/available-policy.entity';
import type {
  GuardSlots,
  PolicyContracts,
  PolicyEnforcement,
} from '@/modules/policies/domain/entities/policy-enforcement.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * Response entities of the policies routes.
 *
 * They exist for the generated OpenAPI schema; the shapes are the domain types,
 * so there is no mapping layer to keep in sync.
 */

export class PolicyTokenInfoDto implements PolicyTokenInfo {
  @ApiProperty()
  public readonly address!: Address;
  @ApiProperty({ type: String, nullable: true })
  public readonly symbol!: string | null;
  @ApiProperty({ type: Number, nullable: true })
  public readonly decimals!: number | null;
  @ApiProperty({ type: String, nullable: true })
  public readonly logoUri!: string | null;
}

export class NamedAddressDto implements NamedAddress {
  @ApiProperty()
  public readonly address!: Address;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Name from the space address book, when known',
  })
  public readonly name!: string | null;
}

export class PolicyContractsDto implements PolicyContracts {
  @ApiProperty({
    description: 'The policy implementation the guard delegates to',
  })
  public readonly policyContract!: Address;
  @ApiProperty({ description: 'The SafePolicyGuard deployment' })
  public readonly safePolicyGuard!: Address;
}

export class GuardSlotsDto implements GuardSlots {
  @ApiProperty({ type: PolicyContractsDto, required: false })
  public readonly transactionGuard?: PolicyContracts;
  @ApiProperty({ type: PolicyContractsDto, required: false })
  public readonly moduleGuard?: PolicyContracts;
}

export class ModuleEnforcementDto {
  @ApiProperty({ enum: [PolicyEnforcementKind.Module] })
  public readonly via!: typeof PolicyEnforcementKind.Module;
  @ApiProperty({ description: 'The module enforcing the policy' })
  public readonly moduleAddress!: Address;
}

export class GuardEnforcementDto {
  @ApiProperty({ enum: [PolicyEnforcementKind.Guard] })
  public readonly via!: typeof PolicyEnforcementKind.Guard;
  @ApiProperty({ type: GuardSlotsDto })
  public readonly guards!: GuardSlots;
}

const EnforcementSchema = {
  oneOf: [
    { $ref: getSchemaPath(ModuleEnforcementDto) },
    { $ref: getSchemaPath(GuardEnforcementDto) },
  ],
  discriminator: { propertyName: 'via' },
};

@ApiExtraModels(ModuleEnforcementDto, GuardEnforcementDto)
export class AvailablePolicyDto implements AvailablePolicy {
  @ApiProperty({ enum: Object.values(PolicyType) })
  public readonly type!: PolicyType;
  @ApiProperty()
  public readonly title!: string;
  @ApiProperty()
  public readonly description!: string;
  @ApiProperty({
    description:
      'Whether the policy can be configured on this chain, i.e. its contracts are deployed and the feature is enabled',
  })
  public readonly available!: boolean;
  @ApiProperty({
    description: 'Policies of this type currently active on this Safe',
  })
  public readonly configuredCount!: number;
  @ApiProperty({
    ...EnforcementSchema,
    nullable: true,
    description:
      'Carries the deployment addresses inline. Null when the policy is not available on this chain.',
  })
  public readonly enforcement!: PolicyEnforcement | null;
}

export class GetAvailablePoliciesResponse {
  @ApiProperty({ type: AvailablePolicyDto, isArray: true })
  public readonly items!: Array<AvailablePolicy>;
}

export class Erc20TransferPolicyAllowlistEntryDto {
  @ApiProperty({ type: PolicyTokenInfoDto })
  public readonly token!: PolicyTokenInfo;
  @ApiProperty({ type: NamedAddressDto, isArray: true })
  public readonly recipients!: Array<NamedAddress>;
}

export class Erc20TransferPolicyDataDto implements Erc20TransferPolicyData {
  @ApiProperty({ type: Erc20TransferPolicyAllowlistEntryDto, isArray: true })
  public readonly allowlist!: Erc20TransferPolicyData['allowlist'];
}

export class CosignerPolicyRuleDto {
  @ApiProperty({ type: PolicyTokenInfoDto })
  public readonly token!: PolicyTokenInfo;
  @ApiProperty({ type: NamedAddressDto })
  public readonly cosigner!: NamedAddress;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Not derivable from the indexed event, which only carries the cosigner address',
  })
  public readonly thresholdAmount!: string | null;
}

export class CosignerPolicyDataDto implements CosignerPolicyData {
  @ApiProperty({ type: CosignerPolicyRuleDto, isArray: true })
  public readonly rules!: CosignerPolicyData['rules'];
}

export class SpendingLimitDto {
  @ApiProperty({ type: PolicyTokenInfoDto })
  public readonly token!: PolicyTokenInfo;
  @ApiProperty()
  public readonly amount!: string;
  @ApiProperty()
  public readonly spent!: string;
  @ApiProperty()
  public readonly nonce!: string;
}

export class SpendingLimitPolicyDataDto implements SpendingLimitPolicyData {
  @ApiProperty()
  public readonly beneficiary!: Address;
  @ApiProperty({ type: SpendingLimitDto, isArray: true })
  public readonly limits!: SpendingLimitPolicyData['limits'];
}

export class RecoveryPolicyDataDto implements RecoveryPolicyData {
  @ApiProperty({ type: String, isArray: true })
  public readonly recoverers!: Array<Address>;
  @ApiProperty()
  public readonly cooldownSec!: string;
  @ApiProperty()
  public readonly expirySec!: string;
}

const PolicyDataSchema = {
  oneOf: [
    { $ref: getSchemaPath(Erc20TransferPolicyDataDto) },
    { $ref: getSchemaPath(CosignerPolicyDataDto) },
    { $ref: getSchemaPath(SpendingLimitPolicyDataDto) },
    { $ref: getSchemaPath(RecoveryPolicyDataDto) },
  ],
};

@ApiExtraModels(
  ModuleEnforcementDto,
  GuardEnforcementDto,
  Erc20TransferPolicyDataDto,
  CosignerPolicyDataDto,
  SpendingLimitPolicyDataDto,
  RecoveryPolicyDataDto,
)
export class ActivePolicyDto implements ActivePolicy {
  @ApiProperty({
    description:
      'Opaque, stable identifier derived from the on-chain access word(s)',
  })
  public readonly id!: Hex;
  @ApiProperty({ enum: Object.values(PolicyType) })
  public readonly type!: PolicyType;
  @ApiProperty(EnforcementSchema)
  public readonly enforcement!: PolicyEnforcement;
  @ApiProperty({
    description:
      'False when the policy is configured but its guard is not set on the Safe, so it is not enforced yet',
  })
  public readonly enabled!: boolean;
  @ApiProperty(PolicyDataSchema)
  public readonly data!: ActivePolicyData;
}

export class GetActivePoliciesResponse {
  @ApiProperty({ type: ActivePolicyDto, isArray: true })
  public readonly items!: Array<ActivePolicy>;
}

@ApiExtraModels(ActivePolicyDto)
export class PendingPolicyDto implements PendingPolicy {
  @ApiProperty({
    description:
      'keccak256(abi.encode(Configuration[])) of the requested configuration',
  })
  public readonly configureRoot!: Hex;
  @ApiProperty({ description: 'Unix seconds of the request' })
  public readonly requestedAt!: number;
  @ApiProperty({
    description: 'Unix seconds from which applyConfiguration is valid',
  })
  public readonly readyAt!: number;
  @ApiProperty()
  public readonly isReady!: boolean;
  @ApiProperty({
    type: ActivePolicyDto,
    nullable: true,
    description:
      'The requested change. Always null for now: requestConfiguration only publishes the configuration hash on-chain.',
  })
  public readonly policy!: ActivePolicy | null;
}

export class GetPendingPoliciesResponse {
  @ApiProperty({ type: PendingPolicyDto, isArray: true })
  public readonly items!: Array<PendingPolicy>;
}
