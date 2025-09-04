import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Contract as DomainContract } from '@/domain/contracts/entities/contract.entity';
import type { Address } from 'viem';

export class Contract implements DomainContract {
  @ApiProperty()
  address!: Address;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  displayName!: string;
  @ApiProperty()
  logoUri!: string;
  @ApiPropertyOptional({ type: Object, nullable: true })
  contractAbi!: Record<string, unknown> | null;
  @ApiProperty()
  trustedForDelegateCall!: boolean;
}
