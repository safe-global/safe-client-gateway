import { Collectible } from './collectible.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Page } from '../../common/entities/page.entity';

export class CollectiblePage extends Page<Collectible> {
  @ApiProperty({ type: Collectible })
  results: Collectible[];
}
