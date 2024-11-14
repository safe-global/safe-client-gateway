import { EligibilityRequest as DomainEligibilityRequest } from '@/domain/community/entities/eligibility-request.entity';
import { ApiProperty } from '@nestjs/swagger';

export class EligibilityRequest implements DomainEligibilityRequest {
  @ApiProperty()
  requestId!: string;
  @ApiProperty()
  sealedData!: string;
}
