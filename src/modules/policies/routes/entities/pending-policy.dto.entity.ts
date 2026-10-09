// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import {
  type PendingGuardConfiguration,
  PendingGuardConfigurationStatus,
  type PendingGuardSetup,
  type PendingGuardSetupChange,
  PendingGuardSetupChangeKind,
  PendingGuardSetupStatus,
  type PendingQueuedPolicy,
  type PendingSpendingLimitChange,
  PendingSpendingLimitChangeKind,
  type PendingSpendingLimitData,
} from '@/modules/policies/domain/entities/pending-policy.entity';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';
import type { ModuleEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { PolicyConfigurationDto } from '@/modules/policies/routes/entities/create-policy-configuration-request.dto.entity';
import {
  ModuleEnforcementDto,
  SafeRefDto,
  SafeRefResponse,
} from '@/modules/policies/routes/entities/policy.dto.entity';

export class EnableModuleChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.EnableModule] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.EnableModule;
}

export class AddDelegateChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.AddDelegate] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.AddDelegate;
  @ApiProperty({
    description:
      'The address being added as a delegate in AllowanceModule contract',
  })
  public readonly delegate!: Address;
}

export class RemoveDelegateChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.RemoveDelegate] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.RemoveDelegate;
  @ApiProperty({ description: 'The delegate being removed' })
  public readonly delegate!: Address;
  @ApiProperty({
    description: "Whether the delegate's allowances are deleted along with it",
  })
  public readonly removeAllowances!: boolean;
}

export class SetAllowanceChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.SetAllowance] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.SetAllowance;
  @ApiProperty()
  public readonly delegate!: Address;
  @ApiProperty({
    description: 'The token the limit applies to; zero address for native',
  })
  public readonly token!: Address;
  @ApiProperty({ description: 'Per-window ceiling, in base units' })
  public readonly amount!: string;
  @ApiProperty({ description: 'Window length in minutes; 0 never resets' })
  public readonly resetPeriodMinutes!: number;
}

export class ResetAllowanceChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.ResetAllowance] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.ResetAllowance;
  @ApiProperty()
  public readonly delegate!: Address;
  @ApiProperty()
  public readonly token!: Address;
}

export class DeleteAllowanceChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.DeleteAllowance] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.DeleteAllowance;
  @ApiProperty()
  public readonly delegate!: Address;
  @ApiProperty()
  public readonly token!: Address;
}

const PendingSpendingLimitChangeSchema = {
  oneOf: [
    { $ref: getSchemaPath(EnableModuleChangeDto) },
    { $ref: getSchemaPath(AddDelegateChangeDto) },
    { $ref: getSchemaPath(RemoveDelegateChangeDto) },
    { $ref: getSchemaPath(SetAllowanceChangeDto) },
    { $ref: getSchemaPath(ResetAllowanceChangeDto) },
    { $ref: getSchemaPath(DeleteAllowanceChangeDto) },
  ],
  discriminator: {
    propertyName: 'kind',
    mapping: {
      [PendingSpendingLimitChangeKind.EnableModule]: getSchemaPath(
        EnableModuleChangeDto,
      ),
      [PendingSpendingLimitChangeKind.AddDelegate]:
        getSchemaPath(AddDelegateChangeDto),
      [PendingSpendingLimitChangeKind.RemoveDelegate]: getSchemaPath(
        RemoveDelegateChangeDto,
      ),
      [PendingSpendingLimitChangeKind.SetAllowance]: getSchemaPath(
        SetAllowanceChangeDto,
      ),
      [PendingSpendingLimitChangeKind.ResetAllowance]: getSchemaPath(
        ResetAllowanceChangeDto,
      ),
      [PendingSpendingLimitChangeKind.DeleteAllowance]: getSchemaPath(
        DeleteAllowanceChangeDto,
      ),
    },
  },
};

@ApiExtraModels(
  EnableModuleChangeDto,
  AddDelegateChangeDto,
  RemoveDelegateChangeDto,
  SetAllowanceChangeDto,
  ResetAllowanceChangeDto,
  DeleteAllowanceChangeDto,
)
export class PendingSpendingLimitDataDto implements PendingSpendingLimitData {
  @ApiProperty({
    description: 'The AllowanceModule deployment holding this state',
  })
  public readonly module!: Address;
  @ApiProperty({
    type: 'array',
    items: PendingSpendingLimitChangeSchema,
    description: 'The AllowanceModule calls this transaction decodes to',
  })
  public readonly changes!: Array<PendingSpendingLimitChange>;
}

@ApiExtraModels(ModuleEnforcementDto, PendingSpendingLimitDataDto)
export class PendingQueuedPolicyDto implements PendingQueuedPolicy {
  @ApiProperty({ enum: ['queued-transaction'] })
  public readonly kind!: 'queued-transaction';
  @ApiProperty({ enum: [PolicyType.SpendingLimit] })
  public readonly type!: PolicyType;
  @ApiProperty({ type: ModuleEnforcementDto })
  public readonly enforcement!: ModuleEnforcement;
  @ApiProperty({
    description: 'The queued transaction this change was found in',
  })
  public readonly safeTxHash!: Hex;
  @ApiProperty()
  public readonly nonce!: number;
  @ApiProperty()
  public readonly confirmations!: number;
  @ApiProperty()
  public readonly confirmationsRequired!: number;
  @ApiProperty({ description: 'Unix seconds the transaction was proposed at' })
  public readonly proposedAt!: number;
  @ApiProperty({ type: PendingSpendingLimitDataDto })
  public readonly data!: PendingSpendingLimitData;
  @ApiProperty({
    type: SafeRefDto,
    description: 'The Safe the change is queued on',
  })
  public readonly safe!: SafeRefResponse;
}

export class PendingTransactionDto {
  @ApiProperty()
  public readonly safeTxHash!: Hex;
  @ApiProperty()
  public readonly nonce!: number;
  @ApiProperty()
  public readonly confirmations!: number;
  @ApiProperty()
  public readonly confirmationsRequired!: number;
  @ApiProperty({ description: 'Unix seconds the transaction was proposed at' })
  public readonly proposedAt!: number;
}

@ApiExtraModels(PolicyConfigurationDto)
export class ConfigureImmediatelyChangeDto {
  @ApiProperty({
    enum: [PendingGuardSetupChangeKind.ConfigureImmediately],
  })
  public readonly kind!: typeof PendingGuardSetupChangeKind.ConfigureImmediately;
  @ApiProperty({ description: 'The SafePolicyGuard being configured' })
  public readonly guard!: Address;
  @ApiProperty({ type: PolicyConfigurationDto, isArray: true })
  public readonly configurations!: Array<PolicyConfiguration>;
  @ApiProperty({
    description:
      'True when the guard is already set on the Safe by the time this call runs, so configureImmediately reverts with GuardAlreadyEnabled',
  })
  public readonly willRevert!: boolean;
}

export class SetGuardChangeDto {
  @ApiProperty({ enum: [PendingGuardSetupChangeKind.SetGuard] })
  public readonly kind!: typeof PendingGuardSetupChangeKind.SetGuard;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The transaction guard before this call; null for none',
  })
  public readonly from!: Address | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The transaction guard after this call; null removes it',
  })
  public readonly to!: Address | null;
}

export class SetModuleGuardChangeDto {
  @ApiProperty({ enum: [PendingGuardSetupChangeKind.SetModuleGuard] })
  public readonly kind!: typeof PendingGuardSetupChangeKind.SetModuleGuard;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The module guard before this call; null for none',
  })
  public readonly from!: Address | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The module guard after this call; null removes it',
  })
  public readonly to!: Address | null;
}

const PendingGuardSetupChangeSchema = {
  oneOf: [
    { $ref: getSchemaPath(ConfigureImmediatelyChangeDto) },
    { $ref: getSchemaPath(SetGuardChangeDto) },
    { $ref: getSchemaPath(SetModuleGuardChangeDto) },
  ],
  discriminator: {
    propertyName: 'kind',
    mapping: {
      [PendingGuardSetupChangeKind.ConfigureImmediately]: getSchemaPath(
        ConfigureImmediatelyChangeDto,
      ),
      [PendingGuardSetupChangeKind.SetGuard]: getSchemaPath(SetGuardChangeDto),
      [PendingGuardSetupChangeKind.SetModuleGuard]: getSchemaPath(
        SetModuleGuardChangeDto,
      ),
    },
  },
};

@ApiExtraModels(
  ConfigureImmediatelyChangeDto,
  SetGuardChangeDto,
  SetModuleGuardChangeDto,
  PendingTransactionDto,
)
export class PendingGuardSetupDto implements PendingGuardSetup {
  @ApiProperty({ enum: ['guard-setup'] })
  public readonly kind!: 'guard-setup';
  @ApiProperty({ enum: Object.values(PendingGuardSetupStatus) })
  public readonly status!: PendingGuardSetup['status'];
  @ApiProperty({
    type: SafeRefDto,
    description: 'The Safe the transaction is queued on',
  })
  public readonly safe!: SafeRefResponse;
  @ApiProperty({
    type: 'array',
    items: PendingGuardSetupChangeSchema,
    description: 'The guard setup calls of the transaction, in calldata order',
  })
  public readonly changes!: Array<PendingGuardSetupChange>;
  @ApiProperty({ type: PendingTransactionDto })
  public readonly transaction!: PendingTransactionDto;
}

@ApiExtraModels(PolicyConfigurationDto, PendingTransactionDto)
export class PendingGuardConfigurationDto implements PendingGuardConfiguration {
  @ApiProperty({ enum: ['guard-configuration'] })
  public readonly kind!: 'guard-configuration';
  @ApiProperty({ enum: Object.values(PendingGuardConfigurationStatus) })
  public readonly status!: PendingGuardConfiguration['status'];
  @ApiProperty({
    type: SafeRefDto,
    description: 'The Safe the configuration belongs to',
  })
  public readonly safe!: SafeRefResponse;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The SafePolicyGuard of the root; null for a draft',
  })
  public readonly guard!: Address | null;
  @ApiProperty({ description: 'keccak256(abi.encode(Configuration[]))' })
  public readonly configureRoot!: Hex;
  @ApiProperty({
    type: PolicyConfigurationDto,
    isArray: true,
    nullable: true,
    description:
      'The configurations behind the root; null when CGW does not know them',
  })
  public readonly configurations!: Array<PolicyConfiguration> | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Unix seconds applyConfiguration is valid from; null until the root is requested on-chain',
  })
  public readonly readyAt!: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Unix seconds the application window closes (readyAt + EXPIRY); null until the root is requested on-chain',
  })
  public readonly expiresAt!: number | null;
  @ApiProperty({
    type: PendingTransactionDto,
    nullable: true,
    description: 'The queued request or apply transaction, if any',
  })
  public readonly transaction!: PendingTransactionDto | null;
  @ApiProperty({ description: 'Unix seconds the change was first seen' })
  public readonly createdAt!: number;
}

/**
 * A pending item is one of three kinds, told apart by `kind`.
 */
export const PendingPolicySchema = {
  oneOf: [
    { $ref: getSchemaPath(PendingQueuedPolicyDto) },
    { $ref: getSchemaPath(PendingGuardSetupDto) },
    { $ref: getSchemaPath(PendingGuardConfigurationDto) },
  ],
  discriminator: {
    propertyName: 'kind',
    mapping: {
      'queued-transaction': getSchemaPath(PendingQueuedPolicyDto),
      'guard-setup': getSchemaPath(PendingGuardSetupDto),
      'guard-configuration': getSchemaPath(PendingGuardConfigurationDto),
    },
  },
};
