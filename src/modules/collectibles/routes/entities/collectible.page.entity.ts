import { ApiProperty } from '@nestjs/swagger';
import { Collectible } from '@/modules/collectibles/routes/entities/collectible.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class CollectiblePage extends Page<Collectible> {
  @ApiProperty({ type: Collectible, isArray: true })
  results!: Array<Collectible>;
}
