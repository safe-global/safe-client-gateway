import { type NativeCurrency as DomainNativeCurrency } from '@/modules/chains/domain/entities/native.currency.entity';
import { ApiProperty } from '@nestjs/swagger';

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
