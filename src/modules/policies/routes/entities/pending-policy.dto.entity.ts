// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import {
  type PendingPolicy,
  type PendingQueuedPolicy,
  type PendingSpendingLimitChange,
  PendingSpendingLimitChangeKind,
  type PendingSpendingLimitData,
} from '@/modules/policies/domain/entities/pending-policy.entity';
import type { ModuleEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import {
  ModuleEnforcementDto,
  SafeRefDto,
  SafeRefResponse,
} from '@/modules/policies/routes/entities/policy.dto.entity';

export class EnableModuleChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.EnableModule] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.EnableModule;
  @ApiProperty({ enum: ['create'] })
  public readonly operation!: 'create';
}

export class AddDelegateChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.AddDelegate] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.AddDelegate;
  @ApiProperty({ enum: ['create'] })
  public readonly operation!: 'create';
  @ApiProperty({ description: 'The address being granted a delegate slot' })
  public readonly delegate!: Address;
}

export class RemoveDelegateChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.RemoveDelegate] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.RemoveDelegate;
  @ApiProperty({ enum: ['remove'] })
  public readonly operation!: 'remove';
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
  @ApiProperty({ enum: ['update'] })
  public readonly operation!: 'update';
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
  @ApiProperty({ enum: ['update'] })
  public readonly operation!: 'update';
  @ApiProperty()
  public readonly delegate!: Address;
  @ApiProperty()
  public readonly token!: Address;
}

export class DeleteAllowanceChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.DeleteAllowance] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.DeleteAllowance;
  @ApiProperty({ enum: ['remove'] })
  public readonly operation!: 'remove';
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
  discriminator: { propertyName: 'kind' },
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
    description: 'The Allowance Module deployment holding this state',
  })
  public readonly module!: Address;
  @ApiProperty({
    isArray: true,
    ...PendingSpendingLimitChangeSchema,
    description: 'The Allowance Module calls this transaction decodes to',
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

export class PendingPolicyDto
  extends PendingQueuedPolicyDto
  implements PendingPolicy {}
