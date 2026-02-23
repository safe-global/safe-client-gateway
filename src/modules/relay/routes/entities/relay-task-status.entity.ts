// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RelayTaskStatus as DomainRelayTaskStatus } from '@/modules/relay/domain/entities/relay-task-status.entity';

class RelayTaskStatusReceipt {
  @ApiProperty({
    example:
      '0x4e4bb4493b2183061c3a0106ea96604edcc84f83313dbc0ab718abb1523d1042',
  })
  transactionHash!: string;
}

export class RelayTaskStatus {
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
    this.status = taskStatus.status;
    this.receipt = taskStatus.receipt && {
      transactionHash: taskStatus.receipt.transactionHash,
    };
  }
}
