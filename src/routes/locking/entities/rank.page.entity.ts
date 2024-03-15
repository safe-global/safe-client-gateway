import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { Rank } from '@/routes/locking/entities/rank.entity';

export class RankPage extends Page<Rank> {
  @ApiProperty({ type: Rank })
  results!: Array<Rank>;
}
