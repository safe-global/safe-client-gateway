// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address } from 'viem';
import type {
  ActivePolicy,
  ActivePolicyData,
  ProposerPolicyData,
  SpendingLimitAllowance,
  SpendingLimitPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
import { DelegateApiVersion } from '@/modules/policies/domain/entities/delegate-api-version.entity';
import type {
  GuardSlots,
  ModuleEnforcement,
  OffChainEnforcement,
  PolicyContracts,
  PolicyEnforcement,
} from '@/modules/policies/domain/entities/policy-enforcement.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * Which Safe an item belongs to.
 */
export type SafeRefResponse = { chainId: string; address: Address };

export class SafeRefDto implements SafeRefResponse {
  @ApiProperty()
  public readonly chainId!: string;
  @ApiProperty()
  public readonly address!: Address;
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

export class ModuleEnforcementDto implements ModuleEnforcement {
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

export class OffChainEnforcementDto implements OffChainEnforcement {
  @ApiProperty({
    enum: [PolicyEnforcementKind.OffChain],
    description:
      'Nothing on chain enforces the policy, so it is access rather than an audited restriction',
  })
  public readonly via!: typeof PolicyEnforcementKind.OffChain;
  @ApiProperty({ enum: ['delegates'], description: 'Where the grant is held' })
  public readonly source!: 'delegates';
}

const EnforcementSchema = {
  oneOf: [
    { $ref: getSchemaPath(ModuleEnforcementDto) },
    { $ref: getSchemaPath(GuardEnforcementDto) },
    { $ref: getSchemaPath(OffChainEnforcementDto) },
  ],
  discriminator: { propertyName: 'via' },
};

export class SpendingLimitAllowanceDto implements SpendingLimitAllowance {
  @ApiProperty({
    description: 'The token the limit applies to; zero address for native',
  })
  public readonly tokenAddress!: Address;
  @ApiProperty({ description: 'Per-window ceiling, in base units' })
  public readonly amount!: string;
  @ApiProperty({ description: 'Spent in the current window, in base units' })
  public readonly spent!: string;
  @ApiProperty({ description: 'Window length in minutes; 0 never resets' })
  public readonly resetPeriodMinutes!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Minutes since the epoch of the next reset, the unit the module counts windows in; null when it never resets',
  })
  public readonly resetsAtMinute!: number | null;
  @ApiProperty({
    description:
      'False when the reset boundary could not be recovered exactly, so `resetsAtMinute` may be up to one period out. `amount` is unaffected.',
  })
  public readonly resetBoundaryIsExact!: boolean;
  @ApiProperty({
    description:
      "False when the spender's delegate registration was removed: nothing is spendable now, but the allowance returns to effect if the delegate is re-added",
  })
  public readonly isDelegateActive!: boolean;
}

export class SpendingLimitSpenderDto {
  @ApiProperty({
    description: 'Name resolved by the client, never carried here',
  })
  public readonly spender!: Address;
  @ApiProperty({
    description:
      'False when the spender is deregistered: nothing is spendable now, but the allowances survive and return if it is re-added',
  })
  public readonly isActive!: boolean;
  @ApiProperty({ type: SpendingLimitAllowanceDto, isArray: true })
  public readonly allowances!: Array<SpendingLimitAllowance>;
}

export class SpendingLimitPolicyDataDto implements SpendingLimitPolicyData {
  @ApiProperty({ description: 'The allowance module holding this state' })
  public readonly module!: Address;
  @ApiProperty({ type: SpendingLimitSpenderDto, isArray: true })
  public readonly spenders!: SpendingLimitPolicyData['spenders'];
}

export class ProposerGrantDto {
  @ApiProperty({ description: 'The owner that granted the proposer' })
  public readonly delegator!: Address;
  @ApiProperty({
    description:
      'The label this owner gave the proposer; empty when unlabelled',
  })
  public readonly label!: string;
}

export class ProposerDto {
  @ApiProperty({ description: 'The address allowed to propose transactions' })
  public readonly proposer!: Address;
  @ApiProperty({
    type: ProposerGrantDto,
    isArray: true,
    description:
      'The owners that granted it, each with the label they gave. The label is stored per grant, so two owners can label the same proposer differently',
  })
  public readonly delegatedBy!: ProposerPolicyData['proposers'][number]['delegatedBy'];
}

export class ProposerPolicyDataDto implements ProposerPolicyData {
  @ApiProperty({
    enum: Object.values(DelegateApiVersion),
    description:
      'The delegates API these grants were read from, and the one a client revokes them through',
  })
  public readonly version!: DelegateApiVersion;
  @ApiProperty({ type: ProposerDto, isArray: true })
  public readonly proposers!: ProposerPolicyData['proposers'];
}

const PolicyDataSchema = {
  oneOf: [
    { $ref: getSchemaPath(SpendingLimitPolicyDataDto) },
    { $ref: getSchemaPath(ProposerPolicyDataDto) },
  ],
};

@ApiExtraModels(
  ModuleEnforcementDto,
  GuardEnforcementDto,
  OffChainEnforcementDto,
  SpendingLimitPolicyDataDto,
  ProposerPolicyDataDto,
)
export class ActivePolicyDto implements ActivePolicy {
  @ApiProperty({ enum: Object.values(PolicyType) })
  public readonly type!: PolicyType;
  @ApiProperty(EnforcementSchema)
  public readonly enforcement!: PolicyEnforcement;
  @ApiProperty({
    description: 'False when the policy is configured but not enforced',
  })
  public readonly enabled!: boolean;
  @ApiProperty(PolicyDataSchema)
  public readonly data!: ActivePolicyData;
  @ApiProperty({
    type: SafeRefDto,
    description: 'The Safe the policy is in effect on',
  })
  public readonly safe!: SafeRefResponse;
}
