import { ApiProperty } from '@nestjs/swagger';

export class IndexingStatus {
  @ApiProperty()
  currentBlockNumber: number;

  @ApiProperty()
  currentBlockTimestamp: Date;

  @ApiProperty()
  erc20BlockNumber: number;

  @ApiProperty()
  erc20BlockTimestamp: Date;

  @ApiProperty()
  erc20Synced: boolean;

  @ApiProperty()
  masterCopiesBlockNumber: number;

  @ApiProperty()
  masterCopiesBlockTimestamp: Date;

  @ApiProperty()
  masterCopiesSynced: boolean;

  @ApiProperty()
  synced: boolean;

  @ApiProperty()
  lastSync: number;

  constructor(args: {
    currentBlockNumber: number;
    currentBlockTimestamp: Date;
    erc20BlockNumber: number;
    erc20BlockTimestamp: Date;
    erc20Synced: boolean;
    masterCopiesBlockNumber: number;
    masterCopiesBlockTimestamp: Date;
    masterCopiesSynced: boolean;
    synced: boolean;
    lastSync: number;
  }) {
    this.currentBlockNumber = args.currentBlockNumber;
    this.currentBlockTimestamp = args.currentBlockTimestamp;
    this.erc20BlockNumber = args.erc20BlockNumber;
    this.erc20BlockTimestamp = args.erc20BlockTimestamp;
    this.erc20Synced = args.erc20Synced;
    this.masterCopiesBlockNumber = args.masterCopiesBlockNumber;
    this.masterCopiesBlockTimestamp = args.masterCopiesBlockTimestamp;
    this.masterCopiesSynced = args.masterCopiesSynced;
    this.synced = args.synced;
    this.lastSync = args.lastSync;
  }
}
