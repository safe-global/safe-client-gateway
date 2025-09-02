import { CreationTransaction as DomainCreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address, Hash } from 'viem';

export class CreationTransaction implements DomainCreationTransaction {
  @ApiProperty()
  created: Date;
  @ApiProperty()
  creator: Address;
  @ApiProperty()
  transactionHash: Hash;
  @ApiProperty()
  factoryAddress: Address;
  @ApiPropertyOptional({ type: String, nullable: true })
  masterCopy: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  setupData: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  saltNonce: string | null;
  @ApiPropertyOptional({ type: DataDecoded, nullable: true })
  dataDecoded: DataDecoded | null;

  constructor(
    created: Date,
    creator: Address,
    transactionHash: Hash,
    factoryAddress: Address,
    masterCopy: Address | null,
    setupData: Address | null,
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
