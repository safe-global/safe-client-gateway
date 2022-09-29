import { Collectible as DomainCollectible } from '../../../domain/collectibles/entities/collectible.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Collectible implements DomainCollectible {
  @ApiProperty()
  address: string;
  @ApiProperty()
  tokenName: string;
  @ApiProperty()
  tokenSymbol: string;
  @ApiProperty()
  logoUri: string;
  @ApiProperty()
  id: string;
  @ApiPropertyOptional()
  uri?: string;
  @ApiPropertyOptional()
  name?: string;
  @ApiPropertyOptional()
  description?: string;
  @ApiPropertyOptional()
  imageUri?: string;
  @ApiPropertyOptional()
  metadata?: Record<string, any>;
}
