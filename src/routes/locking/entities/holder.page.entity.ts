import { Page } from '@/routes/common/entities/page.entity';
import { Holder } from '@/routes/locking/entities/holder.entity';
import { ApiProperty } from '@nestjs/swagger';

export class HolderPage extends Page<Holder> {
  @ApiProperty({ type: Holder })
  results!: Array<Holder>;
}
