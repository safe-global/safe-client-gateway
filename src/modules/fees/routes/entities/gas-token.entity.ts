// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export class GasToken {
  @ApiProperty({
    description: 'Gas token contract address',
    example: '0x0000000000000000000000000000000000000000',
  })
  address: Address;

  @ApiProperty({ description: "The token's ticker symbol", example: 'USDC' })
  symbol: string;

  constructor(args: { address: Address; symbol: string }) {
    this.address = args.address;
    this.symbol = args.symbol;
  }
}
