import { CreationTransaction as DomainCreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreationTransaction implements DomainCreationTransaction {
  @ApiProperty()
  created: Date;
  @ApiProperty()
  creator: `0x${string}`;
  @ApiProperty()
  transactionHash: `0x${string}`;
  @ApiProperty()
  factoryAddress: `0x${string}`;
  @ApiPropertyOptional({ type: String, nullable: true })
  masterCopy: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  setupData: `0x${string}` | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  saltNonce: string | null;
  @ApiPropertyOptional({ type: DataDecoded, nullable: true })
  dataDecoded: DataDecoded | null;

  constructor(
    created: Date,
    creator: `0x${string}`,
    transactionHash: `0x${string}`,
    factoryAddress: `0x${string}`,
    masterCopy: `0x${string}` | null,
    setupData: `0x${string}` | null,
    saltNonce: string | null,
    dataDecoded: DataDecoded | null,
  ) {
    this.created = created;
    this.creator = creator;
    this.transactionHash = transactionHash;
    this.factoryAddress = factoryAddress;
    this.masterCopy = masterCopy;
    this.setupData = setupData;
    this.saltNonce = saltNonce;
    this.dataDecoded = dataDecoded;
  }
}
