// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { Delegate } from '@/modules/delegate/routes/entities/delegate.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class DelegatePage extends Page<Delegate> {
  @ApiProperty({ type: Delegate, isArray: true })
  results!: Array<Delegate>;
}
