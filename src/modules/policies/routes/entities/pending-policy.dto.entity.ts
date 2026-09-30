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
import type { Token } from '@/modules/policies/domain/entities/token.entity';
import {
  Erc20TokenMetadataDto,
  ModuleEnforcementDto,
  NativeTokenMetadataDto,
  SafeRefDto,
  SafeRefResponse,
  TokenMetadataSchema,
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

@ApiExtraModels(NativeTokenMetadataDto, Erc20TokenMetadataDto)
export class SetAllowanceChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.SetAllowance] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.SetAllowance;
  @ApiProperty()
  public readonly delegate!: Address;
  @ApiProperty({
    description: 'The token the limit applies to; zero address for native',
  })
  public readonly token!: Address;
  @ApiProperty({
    ...TokenMetadataSchema,
    nullable: true,
    description: 'Metadata of `token`; null when it could not be resolved',
  })
  public readonly tokenMetadata!: Token | null;
  @ApiProperty({ description: 'Per-window ceiling, in base units' })
  public readonly amount!: string;
  @ApiProperty({ description: 'Window length in minutes; 0 never resets' })
  public readonly resetPeriodMinutes!: number;
}

@ApiExtraModels(NativeTokenMetadataDto, Erc20TokenMetadataDto)
export class ResetAllowanceChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.ResetAllowance] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.ResetAllowance;
  @ApiProperty()
  public readonly delegate!: Address;
  @ApiProperty()
  public readonly token!: Address;
  @ApiProperty({
    ...TokenMetadataSchema,
    nullable: true,
    description: 'Metadata of `token`; null when it could not be resolved',
  })
  public readonly tokenMetadata!: Token | null;
}

@ApiExtraModels(NativeTokenMetadataDto, Erc20TokenMetadataDto)
export class DeleteAllowanceChangeDto {
  @ApiProperty({ enum: [PendingSpendingLimitChangeKind.DeleteAllowance] })
  public readonly kind!: typeof PendingSpendingLimitChangeKind.DeleteAllowance;
  @ApiProperty()
  public readonly delegate!: Address;
  @ApiProperty()
  public readonly token!: Address;
  @ApiProperty({
    ...TokenMetadataSchema,
    nullable: true,
    description: 'Metadata of `token`; null when it could not be resolved',
  })
  public readonly tokenMetadata!: Token | null;
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

export class PendingPolicyDto
  extends PendingQueuedPolicyDto
  implements PendingPolicy {}
