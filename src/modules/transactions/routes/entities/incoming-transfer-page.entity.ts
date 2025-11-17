import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { IncomingTransfer } from '@/modules/transactions/routes/entities/incoming-transfer.entity';

export class IncomingTransferPage extends Page<IncomingTransfer> {
  @ApiProperty({ type: IncomingTransfer, isArray: true })
  results!: Array<IncomingTransfer>;
}
