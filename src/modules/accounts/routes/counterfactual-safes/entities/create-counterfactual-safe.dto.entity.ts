import { CreateCounterfactualSafeDto as DomainCreateCounterfactualSafeDto } from '@/modules/accounts/domain/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export class CreateCounterfactualSafeDto implements DomainCreateCounterfactualSafeDto {
  @ApiProperty()
  chainId!: string;
  @ApiProperty()
  fallbackHandler!: Address;
  @ApiProperty()
  owners!: Array<Address>;
  @ApiProperty()
  predictedAddress!: Address;
  @ApiProperty()
  saltNonce!: string;
  @ApiProperty()
  singletonAddress!: Address;
  @ApiProperty()
  threshold!: number;
}
