import { Page } from '@/routes/common/entities/page.entity';
import { Collectible } from './collectible.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CollectiblePage extends Page<Collectible> {
  @ApiProperty({ type: Collectible })
  results: Collectible[];
}
