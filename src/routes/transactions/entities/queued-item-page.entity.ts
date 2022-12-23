import { ApiProperty } from '@nestjs/swagger';
import { Page } from '../../common/entities/page.entity';
import { QueuedItem } from './queued-item.entity';

export class QueuedItemPage extends Page<QueuedItem> {
  @ApiProperty({ type: QueuedItem })
  results: QueuedItem[];
}
