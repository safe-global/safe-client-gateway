import { ApiProperty } from '@nestjs/swagger';
import { type GasPriceFixedEIP1559 as DomainGasPriceFixedEIP1559 } from '@/modules/chains/domain/entities/gas-price-fixed-eip-1559.entity';

export class GasPriceFixedEIP1559 implements DomainGasPriceFixedEIP1559 {
  @ApiProperty({ enum: ['fixed1559'] })
  type!: 'fixed1559';
  @ApiProperty()
  maxFeePerGas!: string;
  @ApiProperty()
  maxPriorityFeePerGas!: string;
}
