// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { GasToken } from '@/modules/fees/routes/entities/gas-token.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class GasTokenPage extends Page<GasToken> {
  @ApiProperty({ type: GasToken, isArray: true })
  results!: Array<GasToken>;
}
