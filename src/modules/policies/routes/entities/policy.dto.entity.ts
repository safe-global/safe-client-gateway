// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import type {
  ActivePolicy,
  ActivePolicyData,
  CosignerPolicyData,
  Erc20TransferPolicyData,
  SpendingLimitAllowance,
  SpendingLimitPolicyData,
  StatelessPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
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
import { Page } from '@/routes/common/entities/page.entity';

/**
 * Response entities of the policies routes.
 *
 * They exist for the generated OpenAPI schema; the shapes are the domain types,
 * so there is no mapping layer to keep in sync.
 */

/**
 * Which Safe an item belongs to. Carried per item rather than grouped, so
 * nothing merges across chains.
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
  public readonly token_address!: Address;
  @ApiProperty({ description: 'Per-window ceiling, in base units' })
  public readonly amount!: string;
  @ApiProperty({ description: 'Spent in the current window, in base units' })
  public readonly spent!: string;
  @ApiProperty({ description: 'amount - spent, clamped at zero' })
  public readonly remaining!: string;
  @ApiProperty({
    description:
      'What can be spent now: `remaining`, with a window that has already rolled applied. The module resets `spent` lazily and emits no event when it does, so this can exceed `remaining`.',
  })
  public readonly available!: string;
  @ApiProperty({ description: 'Window length in seconds; 0 never resets' })
  public readonly resetPeriodSeconds!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Unix seconds of the next reset; null when it never resets',
  })
  public readonly resetsAt!: number | null;
  @ApiProperty({
    description:
      'False when the reset boundary could not be recovered exactly, so `resetsAt` may be up to one period out. `amount` is unaffected.',
  })
  public readonly resetBoundaryIsExact!: boolean;
  @ApiProperty({ description: 'Next allowance-transfer nonce' })
  public readonly nonce!: string;
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
  @ApiProperty({ description: 'Deployed version of that module' })
  public readonly moduleVersion!: string;
  @ApiProperty({ type: SpendingLimitSpenderDto, isArray: true })
  public readonly spenders!: SpendingLimitPolicyData['spenders'];
}

export class Erc20TransferAllowlistEntryDto {
  @ApiProperty({
    description: 'The token the allowlist applies to; zero address for native',
  })
  public readonly token_address!: Address;
  @ApiProperty({
    type: String,
    isArray: true,
    description:
      'Addresses the Safe may send this token to, accumulated across every configure call',
  })
  public readonly recipients!: Array<Address>;
}

export class Erc20TransferPolicyDataDto implements Erc20TransferPolicyData {
  @ApiProperty({ type: Erc20TransferAllowlistEntryDto, isArray: true })
  public readonly allowlist!: Erc20TransferPolicyData['allowlist'];
}

export class CosignerPolicyDataDto implements CosignerPolicyData {
  @ApiProperty({
    description:
      'The cosigner the policy requires. The whole payload of the event; the access it covers is the item id.',
  })
  public readonly cosigner_address!: Address;
}

/**
 * Allow, deny and native transfer carry no configuration: which calls they cover
 * is already in the item's `id` and `enforcement`.
 */
export class StatelessPolicyDataDto implements StatelessPolicyData {
  // Mirrors `StatelessPolicyData`'s `Record<string, never>`: the payload carries
  // no properties, and adding one here would have to be modelled there first.
  [key: string]: never;
}

const PolicyDataSchema = {
  oneOf: [
    { $ref: getSchemaPath(SpendingLimitPolicyDataDto) },
    { $ref: getSchemaPath(Erc20TransferPolicyDataDto) },
    { $ref: getSchemaPath(CosignerPolicyDataDto) },
    { $ref: getSchemaPath(StatelessPolicyDataDto) },
  ],
};

@ApiExtraModels(
  ModuleEnforcementDto,
  GuardEnforcementDto,
  OffChainEnforcementDto,
  SpendingLimitPolicyDataDto,
  Erc20TransferPolicyDataDto,
  CosignerPolicyDataDto,
  StatelessPolicyDataDto,
)
export class ActivePolicyDto implements ActivePolicy {
  @ApiProperty({
    description:
      'Opaque and stable. The on-chain access word for a guard policy; derived from the type, chain, Safe and module or grantee otherwise.',
  })
  public readonly id!: Hex;
  @ApiProperty({ enum: Object.values(PolicyType) })
  public readonly type!: PolicyType;
  @ApiProperty(EnforcementSchema)
  public readonly enforcement!: PolicyEnforcement;
  @ApiProperty({
    description:
      'False when the policy is configured but not enforced - for a module type, the module is not enabled on the Safe',
  })
  public readonly enabled!: boolean;
  @ApiProperty(PolicyDataSchema)
  public readonly data!: ActivePolicyData;
}

/**
 * An active policy plus the Safe it applies to, for the Space-level route where
 * one list spans several Safes and chains.
 */
export class SpaceActivePolicyDto extends ActivePolicyDto {
  @ApiProperty({ type: SafeRefDto })
  public readonly safe!: SafeRefResponse;
}

export class GetSpaceActivePoliciesPage extends Page<SpaceActivePolicyDto> {
  @ApiProperty({ type: SpaceActivePolicyDto, isArray: true })
  public readonly results!: Array<SpaceActivePolicyDto>;
}
