import { BalancesProvider as DomainBalancesProvider } from '@/domain/chains/entities/balances-provider.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BalancesProvider implements DomainBalancesProvider {
  @ApiPropertyOptional({ type: Number, nullable: true })
  chainName!: string | null;
  @ApiProperty()
  enabled!: boolean;
}
