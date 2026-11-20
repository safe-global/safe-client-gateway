// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { TokenApproval } from '#/modules/token-approvals/routes/entities/token-approval.entity';

export class TokenApprovals {
  @ApiProperty({ type: TokenApproval, isArray: true })
  approvals!: Array<TokenApproval>;
  @ApiProperty({
    description:
      'False when the Safe has more transactions than the scan reads, so older approvals may be missing',
  })
  isHistoryComplete!: boolean;
}
