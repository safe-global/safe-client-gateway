import { Rank as DomainRank } from '@/domain/locking/entities/rank.entity';
import { ApiProperty } from '@nestjs/swagger';

export class Rank implements DomainRank {
  @ApiProperty()
  holder!: `0x${string}`;
  @ApiProperty()
  position!: string;
  @ApiProperty()
  lockedAmount!: string;
  @ApiProperty()
  unlockedAmount!: string;
  @ApiProperty()
  withdrawnAmount!: string;
}
