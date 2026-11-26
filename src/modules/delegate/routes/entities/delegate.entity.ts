// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Delegate {
  @ApiPropertyOptional({ type: String, nullable: true })
  safe!: string | null;
  @ApiProperty()
  delegate!: string;
  @ApiProperty()
  delegator!: string;
  @ApiProperty()
  label!: string;
  @ApiProperty({
    type: Date,
    nullable: true,
    description:
      'When the delegate was registered; null when served from the Transaction Service, which does not report it',
  })
  created!: Date | null;
  @ApiProperty({
    type: Date,
    nullable: true,
    description:
      'When the delegate was last updated; null when served from the Transaction Service, which does not report it',
  })
  modified!: Date | null;
}
