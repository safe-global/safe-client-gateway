import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';

export class Submission {
  @ApiProperty()
  outreachId!: number;
  @ApiProperty()
  targetedSafeId!: number;
  @ApiProperty()
  signerAddress!: Address;
  @ApiPropertyOptional({ type: Date, nullable: true })
  completionDate!: Date | null;

  constructor(
    outreachId: number,
    targetedSafeId: number,
    signerAddress: Address,
    completionDate: Date | null,
  ) {
    this.outreachId = outreachId;
    this.targetedSafeId = targetedSafeId;
    this.signerAddress = signerAddress;
    this.completionDate = completionDate;
  }
}
