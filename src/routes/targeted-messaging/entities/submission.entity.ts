import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Submission {
  @ApiProperty()
  outreachId!: number;
  @ApiProperty()
  targetedSafeId!: number;
  @ApiProperty()
  signerAddress!: `0x${string}`;
  @ApiPropertyOptional({ type: Date, nullable: true })
  completionDate!: Date | null;

  constructor(
    outreachId: number,
    targetedSafeId: number,
    signerAddress: `0x${string}`,
    completionDate: Date | null,
  ) {
    this.outreachId = outreachId;
    this.targetedSafeId = targetedSafeId;
    this.signerAddress = signerAddress;
    this.completionDate = completionDate;
  }
}
