import { ApiProperty } from '@nestjs/swagger';
import { QueuedItem } from '@/routes/transactions/entities/queued-item.entity';

export class ConflictHeaderQueuedItem extends QueuedItem {
  @ApiProperty()
  nonce: number;

  constructor(nonce: number) {
    super('CONFLICT_HEADER');
    this.nonce = nonce;
  }
}
