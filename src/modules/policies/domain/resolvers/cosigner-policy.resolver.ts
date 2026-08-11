// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { CosignerPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyGroup } from '@/modules/policies/domain/entities/policy-group.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { PolicyTokenService } from '@/modules/policies/domain/policy-token.service';
import {
  namedAddress,
  type PolicyResolver,
  type PolicyResolverContext,
  type ResolvedPolicy,
} from '@/modules/policies/domain/resolvers/policy-resolver.interface';
import { policyId } from '@/modules/policies/domain/utils/policy-access.utils';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * `data` of a `CoSignerPolicy` confirmation, as decoded by the Transaction
 * Service: `address cosigner = abi.decode(data, (address))`.
 */
const CosignerPolicyParametersSchema = z.object({
  cosigner: AddressSchema,
});

/**
 * Builds the cosigner rules of a Safe.
 *
 * Aggregation of this policy type: the payload holds a single cosigner, so a
 * later configure call **replaces** the rule of its access instead of adding to
 * it - only the group's newest event is read, and re-configuring a cosigner does
 * not produce a second rule. One rule per access, the token being its target.
 *
 * Read-only for now: the wallet has no builder for this policy yet.
 */
@Injectable()
export class CosignerPolicyResolver implements PolicyResolver {
  public readonly type = PolicyType.Cosigner;

  constructor(
    private readonly policyTokenService: PolicyTokenService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async resolve(
    context: PolicyResolverContext,
  ): Promise<Array<ResolvedPolicy>> {
    const resolved = await Promise.all(
      context.groups.map((group) => this.resolveGroup(group, context)),
    );

    return resolved.filter(
      (policy): policy is ResolvedPolicy => policy !== null,
    );
  }

  private async resolveGroup(
    group: PolicyGroup,
    context: PolicyResolverContext,
  ): Promise<ResolvedPolicy | null> {
    const parameters = CosignerPolicyParametersSchema.safeParse(
      group.latest.dataDecoded?.parameters,
    );

    if (!parameters.success) {
      // Without the cosigner address the rule carries no information, so the
      // item is dropped rather than rendered empty.
      this.loggingService.warn({
        message: 'Could not read CoSignerPolicy cosigner',
        safe: group.latest.safe,
        policy: group.latest.policy,
        transactionHash: group.latest.transactionHash,
      });
      return null;
    }

    const data: CosignerPolicyData = {
      rules: [
        {
          token: await this.policyTokenService.getTokenInfo({
            chainId: context.chainId,
            address: group.latest.target,
          }),
          cosigner: namedAddress(parameters.data.cosigner, context.names),
          thresholdAmount: null,
        },
      ],
    };

    return {
      id: policyId([group.access]),
      type: this.type,
      data,
      groups: [group],
    };
  }
}
