import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { Delegate } from '@/modules/delegate/routes/entities/delegate.entity';

export class DelegatePage extends Page<Delegate> {
  @ApiProperty({ type: Delegate, isArray: true })
  results!: Array<Delegate>;
}
