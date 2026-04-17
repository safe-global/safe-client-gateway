import type { Eligibility } from '@/modules/community/domain/entities/eligibility.entity';
import type { EligibilityRequest } from '@/modules/community/domain/entities/eligibility-request.entity';

export const IIdentityApi = Symbol('IIdentityApi');

export interface IIdentityApi {
  checkEligibility(
    eligibilityRequest: EligibilityRequest,
  ): Promise<Eligibility>;
}
