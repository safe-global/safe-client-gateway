import { ApiProperty } from '@nestjs/swagger';
import { CreationTransaction as DomainCreationTransaction } from '@/modules/safe/domain/entities/creation-transaction.entity';
import type { Address, Hash } from 'viem';

export class TXSCreationTransaction implements DomainCreationTransaction {
  @ApiProperty()
  created: Date;
  @ApiProperty()
  creator: Address;
  @ApiProperty()
  transactionHash: Hash;
  @ApiProperty()
  factoryAddress: Address;
  @ApiProperty()
  masterCopy: Address | null;
  @ApiProperty()
  setupData: Address | null;
  @ApiProperty()
  saltNonce: string | null;

  constructor(args: {
    created: Date;
    creator: Address;
    transactionHash: Hash;
    factoryAddress: Address;
    masterCopy: Address | null;
    setupData: Address | null;
    saltNonce: string | null;
  }) {
    this.created = args.created;
    this.creator = args.creator;
    this.transactionHash = args.transactionHash;
    this.factoryAddress = args.factoryAddress;
    this.masterCopy = args.masterCopy;
    this.setupData = args.setupData;
    this.saltNonce = args.saltNonce;
  }
}
