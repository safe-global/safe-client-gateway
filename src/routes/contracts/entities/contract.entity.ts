import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Contract as DomainContract } from '@/domain/contracts/entities/contract.entity';

export class Contract implements DomainContract {
  @ApiProperty()
  address!: `0x${string}`;
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
