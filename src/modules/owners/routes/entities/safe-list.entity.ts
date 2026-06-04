// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { SafeList as DomainSafeList } from '@/modules/safe/domain/entities/safe-list.entity';

export class SafeList implements DomainSafeList {
  @ApiProperty()
  safes!: Array<Address>;
}
