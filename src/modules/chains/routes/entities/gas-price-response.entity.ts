import { ApiProperty } from '@nestjs/swagger';
import {
  type GasPriceResult as DomainGasPriceResult,
  type GasPriceResponse as DomainGasPriceResponse,
} from '@/modules/chains/domain/entities/gas-price-response.entity';

class GasPriceResult implements DomainGasPriceResult {
  @ApiProperty({ description: 'Last block number', example: '23467872' })
  LastBlock!: string;

  @ApiProperty({
    description: 'Safe gas price recommendation (Gwei)',
    example: '0.496839934',
  })
  SafeGasPrice!: string;

  @ApiProperty({
    description: 'Proposed gas price (Gwei)',
    example: '0.496840168',
  })
  ProposeGasPrice!: string;

  @ApiProperty({
    description: 'Fast gas price recommendation (Gwei)',
    example: '0.55411917',
  })
  FastGasPrice!: string;

  @ApiProperty({
    description: 'Base fee of the next pending block (Gwei)',
    example: '0.496839934',
  })
  suggestBaseFee!: string;

  @ApiProperty({
    description: 'Gas used ratio to estimate network congestion',
    example: '0.5,0.6,0.7',
  })
  gasUsedRatio!: string;
}

export class GasPriceResponse implements DomainGasPriceResponse {
  @ApiProperty({ description: 'Status code ("1" = success)', example: '1' })
  status!: string;

  @ApiProperty({ description: 'Response message', example: 'OK' })
  message!: string;

  @ApiProperty({
    description: 'Gas price data',
    type: GasPriceResult,
  })
  result!: GasPriceResult;
}
