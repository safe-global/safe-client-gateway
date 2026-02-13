import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RelayTaskStatus as DomainRelayTaskStatus } from '@/modules/relay/domain/entities/relay-task-status.entity';

class RelayTaskStatusReceipt {
  @ApiProperty({
    example:
      '0x727c38ad8befa5654f4b58e15efbaa2f64c3c3d31e088ffc515beb95958c6336',
  })
  blockHash!: string;

  @ApiProperty({ example: '0x9c584a' })
  blockNumber!: string;

  @ApiProperty({ example: '0x12145' })
  gasUsed!: string;

  @ApiProperty({
    example:
      '0x4e4bb4493b2183061c3a0106ea96604edcc84f83313dbc0ab718abb1523d1042',
  })
  transactionHash!: string;
}

export class RelayTaskStatus {
  @ApiProperty({ example: '11155111' })
  chainId: string;

  @ApiProperty({
    description: 'Unix timestamp of task creation',
    example: 1770911379,
  })
  createdAt: number;

  @ApiProperty({
    example:
      '0x53061c43e91c22735060433b0fa8314696c771839b158f63ee47110977967de6',
  })
  id: string;

  @ApiProperty({
    description:
      'Relay task status code: 100=Pending, 110=Submitted, 200=Included, 400=Rejected, 500=Reverted',
    enum: [100, 110, 200, 400, 500],
    example: 200,
  })
  status: number;

  @ApiPropertyOptional({
    type: RelayTaskStatusReceipt,
    description:
      'On-chain receipt. Only present when status is 200 (Included) or 500 (Reverted)',
  })
  receipt?: RelayTaskStatusReceipt;

  constructor(taskStatus: DomainRelayTaskStatus) {
    this.chainId = taskStatus.chainId;
    this.createdAt = taskStatus.createdAt;
    this.id = taskStatus.id;
    this.status = taskStatus.status;
    this.receipt = taskStatus.receipt;
  }
}
