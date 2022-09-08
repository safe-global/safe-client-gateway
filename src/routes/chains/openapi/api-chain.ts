import { Chain as DomainChain } from '../../../domain/chains/entities/chain.entity';
import { ApiProperty } from '@nestjs/swagger';
import { NativeCurrency as ApiNativeCurrency } from './api-native-currency';

export class Chain implements DomainChain {
  @ApiProperty()
  chainId: string;
  @ApiProperty()
  chainName: string;
  @ApiProperty()
  nativeCurrency: ApiNativeCurrency;
  @ApiProperty()
  transactionService: string;
  @ApiProperty()
  vpcTransactionService: string;
}
