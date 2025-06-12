import { ApiProperty } from '@nestjs/swagger';

export class BridgeFee {
  @ApiProperty()
  readonly tokenAddress: `0x${string}`;

  @ApiProperty()
  readonly integratorFee: string;

  @ApiProperty()
  readonly lifiFee: string;

  constructor(args: {
    tokenAddress: `0x${string}`;
    integratorFee: string;
    lifiFee: string;
  }) {
    this.tokenAddress = args.tokenAddress;
    this.integratorFee = args.integratorFee;
    this.lifiFee = args.lifiFee;
  }
}
