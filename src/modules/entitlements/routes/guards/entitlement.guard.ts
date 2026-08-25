// SPDX-License-Identifier: FSL-1.1-MIT
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import type { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { SpaceIdParamSchema } from '@/modules/entitlements/routes/guards/space-id-param.schema';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';

/**
 * Rejects a request whose Workspace is at its limit for one feature, with the
 * typed 402. Subclass it per feature: scope is per feature by construction, so
 * being over `safe_seats` never blocks a route gated on another one.
 *
 * Only the coarse answer belongs here — a guard runs before the validation
 * pipe, so it cannot know what the payload consumes. A batch that would
 * overshoot is rejected by the write itself.
 */
export abstract class EntitlementGuard implements CanActivate {
  protected constructor(
    private readonly entitlementEnforcement: IEntitlementEnforcement,
    private readonly spacesRepository: ISpacesRepository,
    private readonly featureKey: FeatureKey,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const { spaceId: spaceUuid } = SpaceIdParamSchema.parse(
      request.params ?? {},
    );
    // No Workspace, no plan; a malformed one is `SpaceIdPipe`'s answer.
    if (spaceUuid === undefined) {
      return true;
    }

    // `SpaceIdPipe` has not run yet: the param is still the UUID.
    const spaceId = await this.spacesRepository.findIdByUuid(spaceUuid);
    await this.entitlementEnforcement.assertWithinQuota({
      spaceId,
      featureKey: this.featureKey,
      delta: 0,
    });
    return true;
  }
}
