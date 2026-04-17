// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { BalancesProvider as DomainBalancesProvider } from '@/modules/chains/domain/entities/balances-provider.entity';

export class BalancesProvider implements DomainBalancesProvider {
  @ApiProperty({ type: String, nullable: true })
  chainName!: string | null;
  @ApiProperty()
  enabled!: boolean;
}
