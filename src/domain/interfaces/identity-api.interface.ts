import type { EligibilityRequest } from '@/modules/community/domain/entities/eligibility-request.entity';
import type { Eligibility } from '@/modules/community/domain/entities/eligibility.entity';

export const IIdentityApi = Symbol('IIdentityApi');

export interface IIdentityApi {
  checkEligibility(
    eligibilityRequest: EligibilityRequest,
  ): Promise<Eligibility>;
}
