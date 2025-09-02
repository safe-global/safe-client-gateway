import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export class BridgeFee {
  @ApiProperty()
  readonly tokenAddress: Address;

  @ApiProperty()
  readonly integratorFee: string;

  @ApiProperty()
  readonly lifiFee: string;

  constructor(args: {
    tokenAddress: Address;
    integratorFee: string;
    lifiFee: string;
  }) {
    this.tokenAddress = args.tokenAddress;
    this.integratorFee = args.integratorFee;
    this.lifiFee = args.lifiFee;
  }
}
