import { BalancesProvider as DomainBalancesProvider } from '@/domain/chains/entities/balances-provider.entity';
import { ApiProperty } from '@nestjs/swagger';

export class BalancesProvider implements DomainBalancesProvider {
  @ApiProperty({ type: String, nullable: true })
  chainName!: string | null;
  @ApiProperty()
  enabled!: boolean;
}
