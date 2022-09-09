import { Balances as DomainBalances } from '../entities/balances.entity';
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Balance as ApiBalance } from './api-balance';

@ApiExtraModels(ApiBalance)
export class Balances implements DomainBalances {
  @ApiProperty()
  fiatTotal: number;
  @ApiProperty({ type: 'array', oneOf: [{ $ref: getSchemaPath(ApiBalance) }] })
  items: ApiBalance[];
}
