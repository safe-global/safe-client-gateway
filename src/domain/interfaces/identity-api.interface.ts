import type { EligibilityRequest } from '@/domain/community/entities/eligibility-request.entity';
import type { Eligibility } from '@/domain/community/entities/eligibility.entity';

export const IIdentityApi = Symbol('IIdentityApi');

export interface IIdentityApi {
  checkEligibility(
    eligibilityRequest: EligibilityRequest,
  ): Promise<Eligibility>;
}
