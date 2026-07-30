// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { AllowPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type {
  PolicyResolver,
  PolicyResolverContext,
  ResolvedPolicy,
} from '@/modules/policies/domain/resolvers/policy-resolver.interface';
import { policyId } from '@/modules/policies/domain/utils/policy-access.utils';

/**
 * Surfaces the `AllowPolicy` grants of a Safe.
 *
 * Aggregation of this policy type: none to speak of. An `AllowPolicy` permits the
 * calls its access word matches - the catch-all fallback (`target` and `selector`
 * zeroed) or one `(target, selector, operation)` - and accesses do not combine
 * into a single grant the way an allowlist's do. So it is one item per group, and
 * re-granting the same access is idempotent rather than cumulative.
 *
 * `data` is intentionally empty: the confirmation carries `0x` with no
 * `dataDecoded`, and which calls the policy covers is already in the item's `id`
 * (the access word) and `enforcement`. No `data` parsing means no group can be
 * dropped here, so unlike the other resolvers this one needs neither a schema nor
 * a logger.
 */
@Injectable()
export class AllowPolicyResolver implements PolicyResolver {
  public readonly type = PolicyType.AllowPolicy;

  public resolve(
    context: PolicyResolverContext,
  ): Promise<Array<ResolvedPolicy>> {
    const data: AllowPolicyData = {};

    return Promise.resolve(
      context.groups.map((group) => ({
        id: policyId([group.access]),
        type: this.type,
        data,
        groups: [group],
      })),
    );
  }
}
