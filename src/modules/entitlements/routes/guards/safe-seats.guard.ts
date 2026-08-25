// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { EntitlementGuard } from '@/modules/entitlements/routes/guards/entitlement.guard';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';

/** Gates a route that takes a Safe seat in the Workspace. */
@Injectable()
export class SafeSeatsGuard extends EntitlementGuard {
  public constructor(
    @Inject(IEntitlementEnforcement)
    entitlementEnforcement: IEntitlementEnforcement,
    @Inject(ISpacesRepository) spacesRepository: ISpacesRepository,
  ) {
    super(entitlementEnforcement, spacesRepository, 'safe_seats');
  }
}
