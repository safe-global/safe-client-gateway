import { LockingRank as DomainLockingRank } from '@/domain/community/entities/locking-rank.entity';
import { ApiProperty } from '@nestjs/swagger';

export class LockingRank implements DomainLockingRank {
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
