import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const GasPriceResultSchema = z.object({
  LastBlock: z.string(),
  SafeGasPrice: z.string(),
  ProposeGasPrice: z.string(),
  FastGasPrice: z.string(),
  suggestBaseFee: z.string(),
  gasUsedRatio: z.string(),
});

export const GasPriceResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: GasPriceResultSchema,
});

class GasPriceResult {
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

export class GasPriceResponse {
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
