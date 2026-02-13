import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RelayTaskStatus as DomainRelayTaskStatus } from '@/modules/relay/domain/entities/relay-task-status.entity';

class RelayTaskStatusReceipt {
  @ApiProperty()
  blockHash!: string;

  @ApiProperty()
  blockNumber!: string;

  @ApiProperty()
  gasUsed!: string;

  @ApiProperty()
  transactionHash!: string;
}

export class RelayTaskStatus {
  @ApiProperty()
  chainId: string;

  @ApiProperty()
  createdAt: number;

  @ApiProperty()
  id: string;

  @ApiProperty({
    description:
      'Status code: 100=Pending, 110=Submitted, 200=Included, 400=Rejected, 500=Reverted',
  })
  status: number;

  @ApiPropertyOptional({ type: RelayTaskStatusReceipt })
  receipt?: RelayTaskStatusReceipt;

  constructor(taskStatus: DomainRelayTaskStatus) {
    this.chainId = taskStatus.chainId;
    this.createdAt = taskStatus.createdAt;
    this.id = taskStatus.id;
    this.status = taskStatus.status;
    this.receipt = taskStatus.receipt;
  }
}
