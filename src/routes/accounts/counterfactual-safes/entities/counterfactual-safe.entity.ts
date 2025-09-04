import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export class CounterfactualSafe {
  @ApiProperty()
  chainId: string;
  @ApiProperty()
  creator: Address;
  @ApiProperty()
  fallbackHandler: Address;
  @ApiProperty({ type: String, isArray: true })
  owners: Array<Address>;
  @ApiProperty()
  predictedAddress: Address;
  @ApiProperty()
  saltNonce: string;
  @ApiProperty()
  singletonAddress: Address;
  @ApiProperty()
  threshold: number;

  constructor(
    chainId: string,
    creator: Address,
    fallbackHandler: Address,
    owners: Array<Address>,
    predictedAddress: Address,
    saltNonce: string,
    singletonAddress: Address,
    threshold: number,
  ) {
    this.chainId = chainId;
    this.creator = creator;
    this.fallbackHandler = fallbackHandler;
    this.owners = owners;
    this.predictedAddress = predictedAddress;
    this.saltNonce = saltNonce;
    this.singletonAddress = singletonAddress;
    this.threshold = threshold;
  }
}
