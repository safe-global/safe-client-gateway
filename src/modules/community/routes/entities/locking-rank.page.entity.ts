// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { LockingRank } from '@/modules/community/routes/entities/locking-rank.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class LockingRankPage extends Page<LockingRank> {
  @ApiProperty({ type: LockingRank, isArray: true })
  results!: Array<LockingRank>;
}
