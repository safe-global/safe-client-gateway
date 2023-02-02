import { ApiProperty } from '@nestjs/swagger';
import { QueuedItem } from '../queued-item.entity';

export enum LabelItem {
  Next = 'Next',
  Queued = 'Queued',
}

export class LabelQueuedItem extends QueuedItem {
  @ApiProperty()
  label: string;

  constructor(label: LabelItem) {
    super('LABEL');
    this.label = label;
  }
}
