import { ApiProperty } from '@nestjs/swagger';

export enum QueuedItemType {
  Label = 'LABEL',
  Transaction = 'TRANSACTION',
  ConflictHeader = 'CONFLICT_HEADER',
}

export class QueuedItem {
  @ApiProperty({ enum: QueuedItemType })
  type: QueuedItemType;

  constructor(type: QueuedItemType) {
    this.type = type;
  }
}
