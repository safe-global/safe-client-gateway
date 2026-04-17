import { ApiProperty } from '@nestjs/swagger';
import type { EligibilityRequest as DomainEligibilityRequest } from '@/modules/community/domain/entities/eligibility-request.entity';

export class EligibilityRequest implements DomainEligibilityRequest {
  @ApiProperty()
  requestId!: string;
  @ApiProperty()
  sealedData!: string;
}
