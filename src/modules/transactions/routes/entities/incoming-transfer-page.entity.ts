import { ApiProperty } from '@nestjs/swagger';
import { IncomingTransfer } from '@/modules/transactions/routes/entities/incoming-transfer.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class IncomingTransferPage extends Page<IncomingTransfer> {
  @ApiProperty({ type: IncomingTransfer, isArray: true })
  results!: Array<IncomingTransfer>;
}
