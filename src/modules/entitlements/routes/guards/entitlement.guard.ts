// SPDX-License-Identifier: FSL-1.1-MIT
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import type { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { SpaceIdParamSchema } from '@/modules/entitlements/routes/guards/space-id-param.schema';
import { assertMember } from '@/modules/spaces/domain/space-assert.utils';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { AUTH_PAYLOAD_REQUEST_PROPERTY } from '@/routes/common/auth/auth-payload.request';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';

/**
 * Rejects a request whose Workspace is at its limit for one feature, with the
 * typed 402. Subclass it per feature: scope is per feature by construction, so
 * being over `safe_seats` never blocks a route gated on another one.
 *
 * Checks membership first: a non-member must never learn a Workspace's
 * plan/quota state, so the entitlement check never runs before it. Must be
 * listed after `AuthGuard`, which is what attaches the session payload to the
 * request.
 *
 * Only the coarse answer belongs here — a guard runs before the validation
 * pipe, so it cannot know what the payload consumes. A batch that would
 * overshoot is rejected by the write itself.
 */
export abstract class EntitlementGuard implements CanActivate {
  protected constructor(
    private readonly entitlementEnforcement: IEntitlementEnforcement,
    private readonly spacesRepository: ISpacesRepository,
    private readonly membersRepository: IMembersRepository,
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
    const userId = getAuthenticatedUserIdOrFail(
      new AuthPayload(request[AUTH_PAYLOAD_REQUEST_PROPERTY]),
    );
    await assertMember(this.membersRepository, spaceId, userId);

    await this.entitlementEnforcement.assertWithinQuota({
      spaceId,
      featureKey: this.featureKey,
      delta: 0,
    });
    return true;
  }
}
