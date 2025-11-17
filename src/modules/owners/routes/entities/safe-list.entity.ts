import { ApiProperty } from '@nestjs/swagger';
import { SafeList as DomainSafeList } from '@/modules/safe/domain/entities/safe-list.entity';
import type { Address } from 'viem';

export class SafeList implements DomainSafeList {
  @ApiProperty()
  safes!: Array<Address>;
}
