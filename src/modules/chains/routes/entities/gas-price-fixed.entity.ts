import { ApiProperty } from '@nestjs/swagger';
import { GasPriceFixed as DomainGasPriceFixed } from '@/modules/chains/domain/entities/gas-price-fixed.entity';

export class GasPriceFixed implements DomainGasPriceFixed {
  @ApiProperty({ enum: ['fixed'] })
  type!: 'fixed';
  @ApiProperty()
  weiValue!: string;
}
