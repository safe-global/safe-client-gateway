// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { LockingRank as DomainLockingRank } from '@/modules/community/domain/entities/locking-rank.entity';

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
