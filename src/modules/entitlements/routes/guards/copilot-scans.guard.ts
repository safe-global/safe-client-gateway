// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { EntitlementGuard } from '@/modules/entitlements/routes/guards/entitlement.guard';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

/** Gates a route that runs Copilot recipient/counterparty analysis on a Space. */
@Injectable()
export class CopilotScansGuard extends EntitlementGuard {
  public constructor(
    @Inject(IEntitlementEnforcement)
    entitlementEnforcement: IEntitlementEnforcement,
    @Inject(ISpacesRepository) spacesRepository: ISpacesRepository,
    @Inject(IMembersRepository) membersRepository: IMembersRepository,
  ) {
    super(
      entitlementEnforcement,
      spacesRepository,
      membersRepository,
      'copilot_scans',
    );
  }
}
