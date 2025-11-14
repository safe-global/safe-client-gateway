import { ApiProperty } from '@nestjs/swagger';
import { GasPriceOracle as DomainGasPriceOracle } from '@/modules/chains/domain/entities/gas-price-oracle.entity';

export class GasPriceOracle implements DomainGasPriceOracle {
  @ApiProperty({ enum: ['oracle'] })
  type!: 'oracle';
  @ApiProperty()
  gasParameter!: string;
  @ApiProperty()
  gweiFactor!: string;
  @ApiProperty()
  uri!: string;
}
