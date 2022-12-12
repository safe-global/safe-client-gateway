import { ApiProperty } from '@nestjs/swagger';
import { Page } from '../../common/entities/page.entity';
import { IncomingTransfer } from './incoming-transfer.entity';

export class IncomingTransferPage extends Page<IncomingTransfer> {
  @ApiProperty({ type: IncomingTransfer })
  results: IncomingTransfer[];
}
