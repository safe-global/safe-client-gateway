// SPDX-License-Identifier: FSL-1.1-MIT
import type { Eligibility as DomainEligibility } from '@/modules/community/domain/entities/eligibility.entity';
import { ApiProperty } from '@nestjs/swagger';

export class Eligibility implements DomainEligibility {
  @ApiProperty()
  requestId!: string;
  @ApiProperty()
  isAllowed!: boolean;
  @ApiProperty()
  isVpn!: boolean;
}
