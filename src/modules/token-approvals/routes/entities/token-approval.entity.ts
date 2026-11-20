// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export class TokenApproval {
  @ApiProperty({ description: 'The ERC-20 token the allowance is for' })
  tokenAddress!: Address;
  @ApiProperty({ description: 'The address allowed to spend the token' })
  spender!: Address;
  @ApiProperty({
    description:
      'The current on-chain allowance, in the smallest unit of the token',
  })
  allowance!: string;
}
