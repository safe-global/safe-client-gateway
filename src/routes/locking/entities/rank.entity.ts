import { Rank as DomainRank } from '@/domain/community/entities/rank.entity';
import { ApiProperty } from '@nestjs/swagger';

export class Rank implements DomainRank {
  @ApiProperty()
  holder!: `0x${string}`;
  @ApiProperty()
  position!: number;
  @ApiProperty()
  lockedAmount!: string;
  @ApiProperty()
  unlockedAmount!: string;
  @ApiProperty()
  withdrawnAmount!: string;
}
