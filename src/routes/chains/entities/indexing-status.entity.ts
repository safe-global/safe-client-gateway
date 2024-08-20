import { ApiProperty } from '@nestjs/swagger';

export class IndexingStatus {
  @ApiProperty()
  lastSync: number;

  @ApiProperty()
  synced: boolean;

  constructor(args: { lastSync: number; synced: boolean }) {
    this.lastSync = args.lastSync;
    this.synced = args.synced;
  }
}
