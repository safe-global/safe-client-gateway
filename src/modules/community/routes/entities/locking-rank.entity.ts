import { type LockingRank as DomainLockingRank } from '@/modules/community/domain/entities/locking-rank.entity';
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export class LockingRank implements DomainLockingRank {
  @ApiProperty()
  holder!: Address;
  @ApiProperty()
  position!: number;
  @ApiProperty()
  lockedAmount!: string;
  @ApiProperty()
  unlockedAmount!: string;
  @ApiProperty()
  withdrawnAmount!: string;
}
