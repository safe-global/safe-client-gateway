import { Collectible as DomainCollectible } from '@/modules/collectibles/domain/entities/collectible.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';

export class Collectible implements DomainCollectible {
  @ApiProperty()
  address!: Address;
  @ApiProperty()
  tokenName!: string;
  @ApiProperty()
  tokenSymbol!: string;
  @ApiProperty()
  logoUri!: string;
  @ApiProperty()
  id!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  uri!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  name!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  imageUri!: string | null;
  @ApiPropertyOptional({ type: Object, nullable: true })
  metadata!: Record<string, unknown> | null;
}
