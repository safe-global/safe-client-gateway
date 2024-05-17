import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { LockingRank } from '@/routes/locking/entities/locking-rank.entity';

export class LockingRankPage extends Page<LockingRank> {
  @ApiProperty({ type: LockingRank })
  results!: Array<LockingRank>;
}
