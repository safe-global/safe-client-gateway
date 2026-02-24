import { type EligibilityRequest as DomainEligibilityRequest } from '@/modules/community/domain/entities/eligibility-request.entity';
import { ApiProperty } from '@nestjs/swagger';

export class EligibilityRequest implements DomainEligibilityRequest {
  @ApiProperty()
  requestId!: string;
  @ApiProperty()
  sealedData!: string;
}
