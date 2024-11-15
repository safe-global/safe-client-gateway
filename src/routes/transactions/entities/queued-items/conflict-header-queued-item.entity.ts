import { ApiProperty } from '@nestjs/swagger';
import {
  QueuedItem,
  QueuedItemType,
} from '@/routes/transactions/entities/queued-item.entity';

export class ConflictHeaderQueuedItem extends QueuedItem {
  @ApiProperty({ enum: [QueuedItemType.ConflictHeader] })
  override type = QueuedItemType.ConflictHeader;
  @ApiProperty()
  nonce: number;

  constructor(nonce: number) {
    super(QueuedItemType.ConflictHeader);
    this.nonce = nonce;
  }
}
