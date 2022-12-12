import { ApiProperty } from '@nestjs/swagger';

export class IncomingTransfer {
  @ApiProperty()
  type: string;
  @ApiProperty()
  transaction: string;
  @ApiProperty()
  conflictType: string;
}
