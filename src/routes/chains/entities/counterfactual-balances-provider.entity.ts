import { CounterfactualBalancesProvider as DomainCounterfactualBalancesProvider } from '@/domain/chains/entities/counterfactual-balances-provider.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CounterfactualBalancesProvider
  implements DomainCounterfactualBalancesProvider
{
  @ApiPropertyOptional({ type: Number, nullable: true })
  chainName!: string | null;
  @ApiProperty()
  enabled!: boolean;
}
