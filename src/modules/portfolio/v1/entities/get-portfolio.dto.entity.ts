import { GetPortfolioDtoSchema } from '@/modules/portfolio/v1/entities/schemas/get-portfolio.dto.schema';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class GetPortfolioDto implements z.infer<typeof GetPortfolioDtoSchema> {
  @ApiPropertyOptional({
    description: 'Fiat currency code for balance conversion (e.g., USD, EUR)',
    example: 'USD',
    default: 'USD',
  })
  public readonly fiatCode!: string;

  @ApiPropertyOptional({
    description:
      'Comma-separated list of chain IDs to filter by. If omitted, returns data for all chains.',
    example: '1,137,42161',
  })
  public readonly chainIds?: Array<string>;

  @ApiPropertyOptional({
    description: 'If true, only returns trusted tokens',
    example: true,
    default: true,
  })
  public readonly trusted!: boolean;

  @ApiPropertyOptional({
    description: 'If true, filters out dust positions (balance < $0.001 USD)',
    example: true,
    default: true,
  })
  public readonly excludeDust!: boolean;

  @ApiPropertyOptional({
    description:
      'If true, waits for position data to be aggregated before responding (up to 30s)',
    example: false,
    default: false,
  })
  public readonly sync!: boolean;
}
