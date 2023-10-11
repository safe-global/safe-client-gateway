import { Page } from '@/routes/common/entities/page.entity';
import { Chain } from './chain.entity';
import { ApiProperty } from '@nestjs/swagger';

export class ChainPage extends Page<Chain> {
  @ApiProperty({ type: Chain })
  results: Chain[];
}
