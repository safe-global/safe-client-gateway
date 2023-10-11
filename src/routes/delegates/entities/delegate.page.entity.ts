import { Delegate } from './delegate.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';

export class DelegatePage extends Page<Delegate> {
  @ApiProperty({ type: Delegate })
  results: Delegate[];
}
