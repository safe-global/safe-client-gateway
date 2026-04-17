// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { NativeCurrency as DomainNativeCurrency } from '@/modules/chains/domain/entities/native.currency.entity';

export class NativeCurrency implements DomainNativeCurrency {
  @ApiProperty()
  decimals!: number;
  @ApiProperty()
  logoUri!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  symbol!: string;
}
