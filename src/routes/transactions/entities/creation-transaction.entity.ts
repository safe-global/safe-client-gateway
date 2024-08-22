import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreationTransaction {
  @ApiProperty()
  created: Date;
  @ApiProperty()
  creator: string;
  @ApiProperty()
  transactionHash: string;
  @ApiProperty()
  factoryAddress: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  masterCopy: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  setupData: string | null;
  @ApiPropertyOptional({ type: DataDecoded, nullable: true })
  dataDecoded: DataDecoded | null;

  constructor(
    created: Date,
    creator: string,
    transactionHash: string,
    factoryAddress: string,
    masterCopy: string | null,
    setupData: string | null,
    dataDecoded: DataDecoded | null,
  ) {
    this.created = created;
    this.creator = creator;
    this.transactionHash = transactionHash;
    this.factoryAddress = factoryAddress;
    this.masterCopy = masterCopy;
    this.setupData = setupData;
    this.dataDecoded = dataDecoded;
  }
}
