import { ApiProperty } from '@nestjs/swagger';
import { DataDecoded } from '@/domain/data-decoder/v1/entities/data-decoded.entity';
import { CreationTransaction as DomainCreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';

export class TXSCreationTransaction implements DomainCreationTransaction {
  @ApiProperty()
  created: Date;
  @ApiProperty()
  creator: `0x${string}`;
  @ApiProperty()
  transactionHash: `0x${string}`;
  @ApiProperty()
  factoryAddress: `0x${string}`;
  @ApiProperty()
  masterCopy: `0x${string}` | null;
  @ApiProperty()
  setupData: `0x${string}` | null;
  @ApiProperty()
  saltNonce: string | null;
  @ApiProperty()
  dataDecoded: DataDecoded | null;

  constructor(args: {
    created: Date;
    creator: `0x${string}`;
    transactionHash: `0x${string}`;
    factoryAddress: `0x${string}`;
    masterCopy: `0x${string}` | null;
    setupData: `0x${string}` | null;
    saltNonce: string | null;
    dataDecoded: DataDecoded | null;
  }) {
    this.created = args.created;
    this.creator = args.creator;
    this.transactionHash = args.transactionHash;
    this.factoryAddress = args.factoryAddress;
    this.masterCopy = args.masterCopy;
    this.setupData = args.setupData;
    this.saltNonce = args.saltNonce;
    this.dataDecoded = args.dataDecoded;
  }
}
