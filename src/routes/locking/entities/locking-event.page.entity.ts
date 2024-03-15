import {
  LockEventItem as DomainLockEventItem,
  UnlockEventItem as DomainUnlockEventItem,
  WithdrawEventItem as DomainWithdrawEventItem,
} from '@/domain/locking/entities/locking-event.entity';
import { LockingEventType } from '@/domain/locking/entities/schemas/locking-event.schema';
import { Page } from '@/routes/common/entities/page.entity';
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

class LockEventItem implements DomainLockEventItem {
  @ApiProperty({ enum: [LockingEventType.LOCKED] })
  eventType!: LockingEventType.LOCKED;
  @ApiProperty({ type: String })
  executionDate!: Date;
  @ApiProperty()
  transactionHash!: `0x${string}`;
  @ApiProperty()
  holder!: `0x${string}`;
  @ApiProperty()
  amount!: string;
  @ApiProperty()
  logIndex!: string;
}

class UnlockEventItem implements DomainUnlockEventItem {
  @ApiProperty({ enum: [LockingEventType.UNLOCKED] })
  eventType!: LockingEventType.UNLOCKED;
  @ApiProperty({ type: String })
  executionDate!: Date;
  @ApiProperty()
  transactionHash!: `0x${string}`;
  @ApiProperty()
  holder!: `0x${string}`;
  @ApiProperty()
  amount!: string;
  @ApiProperty()
  logIndex!: string;
  @ApiProperty()
  unlockIndex!: string;
}

class WithdrawEventItem implements DomainWithdrawEventItem {
  @ApiProperty({ enum: [LockingEventType.WITHDRAWN] })
  eventType!: LockingEventType.WITHDRAWN;
  @ApiProperty({ type: String })
  executionDate!: Date;
  @ApiProperty()
  transactionHash!: `0x${string}`;
  @ApiProperty()
  holder!: `0x${string}`;
  @ApiProperty()
  amount!: string;
  @ApiProperty()
  logIndex!: string;
  @ApiProperty()
  unlockIndex!: string;
}

@ApiExtraModels(LockEventItem, UnlockEventItem, WithdrawEventItem)
export class LockingEventPage extends Page<
  DomainLockEventItem | DomainUnlockEventItem | DomainWithdrawEventItem
> {
  @ApiProperty({
    isArray: true,
    oneOf: [
      { $ref: getSchemaPath(LockEventItem) },
      { $ref: getSchemaPath(UnlockEventItem) },
      { $ref: getSchemaPath(WithdrawEventItem) },
    ],
  })
  results!: Array<
    DomainLockEventItem | DomainUnlockEventItem | DomainWithdrawEventItem
  >;
}
